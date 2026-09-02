import { lessonSchema, objectIdSchema } from "@lms/shared";
import { Router } from "express";
import { z } from "zod";

import { loadLessonById } from "../lessons/lessonAccess.js";
import {
  getAuthenticatedUser,
  requireAuth,
} from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { validate } from "../middleware/validate.js";
import { toLesson } from "../models/Lesson.js";
import { findLinkedTestId } from "../tests/testLink.js";

/**
 * Reading a single lesson is flat because specification 6 routes the editing
 * screen as `/manage/lessons/:lessonId/edit`, without a course. Every mutation
 * stays under the course, where specification 9.2 puts it.
 */
export const lessonsRouter = Router();

const lessonParamsSchema = z.object({ lessonId: objectIdSchema });

lessonsRouter.use(requireAuth, requireRole("teacher", "admin"));

lessonsRouter.get(
  "/:lessonId",
  validate(lessonParamsSchema, "params"),
  async (request, response) => {
    const lessonId = request.params.lessonId as string;
    const { lesson } = await loadLessonById(
      lessonId,
      getAuthenticatedUser(request),
    );

    response.json(
      lessonSchema.parse(toLesson(lesson, await findLinkedTestId(lesson._id))),
    );
  },
);
