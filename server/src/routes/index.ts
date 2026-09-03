import { Router } from "express";

import { adminDashboardRouter } from "./adminDashboard.js";
import { adminStatisticsRouter } from "./adminStatistics.js";
import { adminUsersRouter } from "./adminUsers.js";
import { authRouter } from "./auth.js";
import { coursesRouter } from "./courses.js";
import { healthRouter } from "./health.js";
import { learningRouter } from "./learning.js";
import { lessonsRouter } from "./lessons.js";
import { testsRouter } from "./tests.js";
import { usersRouter } from "./users.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/admin/dashboard", adminDashboardRouter);
apiRouter.use("/admin/statistics", adminStatisticsRouter);
apiRouter.use("/admin/users", adminUsersRouter);
apiRouter.use("/courses", coursesRouter);
apiRouter.use("/learning", learningRouter);
apiRouter.use("/lessons", lessonsRouter);
apiRouter.use("/tests", testsRouter);
apiRouter.use("/users", usersRouter);
