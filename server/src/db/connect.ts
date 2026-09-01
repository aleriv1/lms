import mongoose from "mongoose";

import { env } from "../config/env.js";

export async function connectToDatabase(): Promise<void> {
  await mongoose.connect(env.mongodbUri);
}
