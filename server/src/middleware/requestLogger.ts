import type { RequestHandler } from "express";

export const requestLogger: RequestHandler = (request, response, next) => {
  const startedAt = performance.now();
  const path = request.originalUrl.split("?", 1)[0] ?? request.path;

  response.on("finish", () => {
    const duration = Math.round(performance.now() - startedAt);
    console.info(
      `${request.method} ${path} ${response.statusCode} ${duration}ms`,
    );
  });

  next();
};
