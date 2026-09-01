import { Router } from "express";
import mongoose from "mongoose";

export const healthRouter = Router();

healthRouter.get("/", (_request, response) => {
  // Infrastructure health is deliberately outside the shared wire contract.
  response.status(200).json({
    status: "ok",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});
