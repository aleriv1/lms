import { objectIdSchema, testSchema } from "@lms/shared";
import { Router } from "express";
import { z } from "zod";

import {
  getAuthenticatedUser,
  requireAuth,
} from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { validate } from "../middleware/validate.js";
import { toTest } from "../models/Test.js";
import { loadTestById } from "../tests/testAccess.js";

/**
 * Reading a single test is flat because specification 6 routes the editing
 * screen as `/manage/tests/:testId/edit`, without a course. Every mutation
 * stays under the course, where specification 9.2 puts it.
 */
export const testsRouter = Router();

const testParamsSchema = z.object({ testId: objectIdSchema });

testsRouter.use(requireAuth, requireRole("teacher", "admin"));

testsRouter.get(
  "/:testId",
  validate(testParamsSchema, "params"),
  async (request, response) => {
    const testId = request.params.testId as string;
    const { test } = await loadTestById(testId, getAuthenticatedUser(request));

    response.json(testSchema.parse(toTest(test)));
  },
);
