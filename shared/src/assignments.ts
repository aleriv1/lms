import { z } from "zod";

import { courseRefSchema, isoDateTimeSchema, objectIdSchema, percentSchema, userRefSchema } from "./common.js";
import { assignmentStatusSchema, courseStatusSchema } from "./enums.js";

/** Назначение курса (ТЗ, 8.5). Создаёт и снимает только администратор (ТЗ, 3.2). */
export const assignmentSchema = z.object({
  id: objectIdSchema,
  userId: objectIdSchema,
  course: courseRefSchema.extend({
    status: courseStatusSchema,
  }),
  assignedBy: userRefSchema,
  status: assignmentStatusSchema,
  progressPercent: percentSchema,
  assignedAt: isoDateTimeSchema,
  revokedAt: isoDateTimeSchema.nullable(),
  completedAt: isoDateTimeSchema.nullable(),
});
export type Assignment = z.infer<typeof assignmentSchema>;

/** POST /admin/users/:userId/assignments — назначить можно только опубликованный курс (ТЗ, 4.3). */
export const createAssignmentBodySchema = z.object({
  courseId: objectIdSchema,
});
export type CreateAssignmentBody = z.infer<typeof createAssignmentBodySchema>;
