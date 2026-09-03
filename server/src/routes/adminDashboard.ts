import { adminDashboardSchema } from "@lms/shared";
import { Router } from "express";
import type { Types } from "mongoose";

import { countLessonsPerCourse } from "../courses/lessonCounts.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import {
  Course,
  COURSE_AUTHOR_FIELDS,
  toCourseListItem,
} from "../models/Course.js";
import { CourseAssignment } from "../models/CourseAssignment.js";
import { Test } from "../models/Test.js";
import { User } from "../models/User.js";
import {
  averageProgressOverUsers,
  loadPairProgress,
  PAIR_STAGES,
} from "../statistics/pairProgress.js";

/**
 * `GET /admin/dashboard` (specification 7.10). Every card is a real aggregate:
 * the specification requires it in so many words, and slice 02 shipped the
 * page with constants that this route replaces.
 */
export const adminDashboardRouter = Router();

adminDashboardRouter.use(requireAuth, requireRole("admin"));

/** Not a figure from the specification: it is the size of the block on the page. */
const RECENT_COURSES_LIMIT = 5;

const NEW_USERS_WINDOW_DAYS = 7;

adminDashboardRouter.get("/", async (_request, response) => {
  const newUsersSince = new Date(
    Date.now() - NEW_USERS_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  const [
    activeCoursesCount,
    usersCount,
    testsCount,
    activeAssignmentsCount,
    newUsersLast7DaysCount,
    completedCoursesCount,
    pairs,
    recentCourses,
  ] = await Promise.all([
    // "An active course" is a published one: neither a draft nor an archived
    // course is being taken by anybody (specification 4.2).
    Course.countDocuments({ status: "published" }),
    // Every account, blocked and archived included — the same figure the
    // unfiltered `/admin/users` reports as `total`, and two counters on two
    // administrative pages have to agree.
    User.countDocuments({}),
    Test.countDocuments({}),
    CourseAssignment.countDocuments({ status: "active" }),
    User.countDocuments({ createdAt: { $gte: newUsersSince } }),
    // Finished assignments and not distinct courses: the card is about the
    // volume of training done, and a course finished by ten people is ten
    // completions.
    CourseAssignment.countDocuments({ status: "completed" }),
    loadPairProgress({ statuses: PAIR_STAGES }),
    // Recently created, so the status does not matter: an administrator sees
    // drafts and the archive too.
    Course.find({})
      .sort({ createdAt: -1, _id: -1 })
      .limit(RECENT_COURSES_LIMIT)
      .populate<{ authorId: { _id: Types.ObjectId; name: string } }>(
        "authorId",
        COURSE_AUTHOR_FIELDS,
      ),
  ]);

  const lessonsCounts = await countLessonsPerCourse(
    recentCourses.map((course) => course._id),
  );

  response.json(
    adminDashboardSchema.parse({
      activeCoursesCount,
      usersCount,
      testsCount,
      activeAssignmentsCount,
      newUsersLast7DaysCount,
      completedCoursesCount,
      averageProgressPercent: averageProgressOverUsers(pairs),
      recentCourses: recentCourses.map((course) =>
        toCourseListItem(
          course,
          lessonsCounts.get(course._id.toString()) ?? 0,
        ),
      ),
    }),
  );
});
