import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";

import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { apiRouter } from "./routes/index.js";

export const app = express();

app.use(requestLogger);
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use("/api", apiRouter);
app.use(notFound);
app.use(errorHandler);
