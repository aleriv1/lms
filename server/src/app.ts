import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import path from "node:path";

import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { apiRouter } from "./routes/index.js";

export const app = express();

if (env.nodeEnv === "production") {
  app.set("trust proxy", 1);
}

app.use(requestLogger);
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use("/api", apiRouter);

if (env.nodeEnv === "production") {
  const clientDist = path.resolve(import.meta.dirname, "../../client/dist");

  // The free Render plan provides one service, so the API also serves the built client.
  app.use(express.static(clientDist));
  app.use((request, response, next) => {
    if (request.method === "GET" && !request.path.startsWith("/api")) {
      response.sendFile(path.join(clientDist, "index.html"));
      return;
    }

    next();
  });
}

app.use(notFound);
app.use(errorHandler);
