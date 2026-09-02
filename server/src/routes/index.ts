import { Router } from "express";

import { authRouter } from "./auth.js";
import { coursesRouter } from "./courses.js";
import { healthRouter } from "./health.js";
import { lessonsRouter } from "./lessons.js";
import { testsRouter } from "./tests.js";
import { usersRouter } from "./users.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/courses", coursesRouter);
apiRouter.use("/lessons", lessonsRouter);
apiRouter.use("/tests", testsRouter);
apiRouter.use("/users", usersRouter);
