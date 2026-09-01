import "dotenv/config";

import { app } from "./app.js";
import { env } from "./config/env.js";
import { connectToDatabase } from "./db/connect.js";

try {
  await connectToDatabase();
  app.listen(env.port, () => {
    console.info(`Server is listening on port ${env.port}`);
  });
} catch (error) {
  console.error("Failed to connect to MongoDB", error);
  process.exit(1);
}
