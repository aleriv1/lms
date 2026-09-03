import { apiErrorSchema, assignmentSchema } from "@lms/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Course } from "../models/Course.js";
import { CourseAssignment } from "../models/CourseAssignment.js";
import {
  clearDatabase,
  connectTestDatabase,
  createUser,
  disconnectTestDatabase,
  signIn,
  TEST_PASSWORD,
} from "../testing/apiClient.js";

beforeAll(connectTestDatabase, 120_000);
afterAll(disconnectTestDatabase);
beforeEach(clearDatabase);

describe("assignments over HTTP", () => {
  it("assigns a course, refuses an active duplicate and persists revocation", async () => {
    const admin = await createUser({ role: "admin" });
    const student = await createUser();
    const course = await Course.create({
      title: "Назначаемый курс",
      category: "Обучение",
      audience: "general",
      shortDescription: "Опубликованный курс для назначения",
      authorId: admin._id,
      status: "published",
    });
    const agent = await signIn(admin.email, TEST_PASSWORD);
    const path = `/api/admin/users/${student._id}/assignments`;
    const created = await agent
      .post(path)
      .send({ courseId: course._id.toString() })
      .expect(201);
    const assignment = assignmentSchema.parse(created.body);
    expect(assignment).toMatchObject({
      userId: student._id.toString(),
      course: { id: course._id.toString() },
      assignedBy: { id: admin._id.toString() },
      status: "active",
      revokedAt: null,
    });
    expect(await CourseAssignment.findById(assignment.id)).toMatchObject({
      status: "active",
    });
    const duplicate = await agent
      .post(path)
      .send({ courseId: course._id.toString() })
      .expect(409);
    expect(apiErrorSchema.parse(duplicate.body).code).toBe("assignment_exists");
    expect(
      await CourseAssignment.countDocuments({
        userId: student._id,
        courseId: course._id,
        status: "active",
      }),
    ).toBe(1);
    const revoked = await agent.delete(`${path}/${assignment.id}`).expect(200);
    expect(assignmentSchema.parse(revoked.body).status).toBe("revoked");
    const stored = await CourseAssignment.findById(assignment.id);
    expect(stored?.status).toBe("revoked");
    expect(stored?.revokedAt?.toISOString()).toBe(
      assignmentSchema.parse(revoked.body).revokedAt,
    );
    expect(stored?.revokedAt).toBeInstanceOf(Date);
  });

  it.each(["draft", "archived"] as const)(
    "refuses assigning a %s course",
    async (status) => {
      const admin = await createUser({ role: "admin" });
      const student = await createUser();
      const course = await Course.create({
        title: "Недоступный курс",
        category: "Обучение",
        audience: "general",
        shortDescription: "Курс недоступен для нового назначения",
        authorId: admin._id,
        status,
      });
      const agent = await signIn(admin.email, TEST_PASSWORD);
      const response = await agent
        .post(`/api/admin/users/${student._id}/assignments`)
        .send({ courseId: course._id.toString() })
        .expect(422);
      expect(apiErrorSchema.parse(response.body)).toMatchObject({
        code: "unprocessable",
        fields: [{ field: "courseId" }],
      });
      expect(await CourseAssignment.countDocuments()).toBe(0);
    },
  );
});
