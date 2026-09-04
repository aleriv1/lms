import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";

// Explicit values keep dotenv and the developer's environment away from reset.
export const serverEnv = {
  NODE_ENV: "test",
  PORT: "4100",
  MONGODB_URI: "mongodb://localhost:27017/corporate-learning-e2e",
  CLIENT_ORIGIN: "http://localhost:5273",
  JWT_SECRET: randomBytes(32).toString("hex"),
};

export default function globalSetup() {
  try {
    execFileSync(process.execPath, ["dist/scripts/seed.js", "--reset"], {
      cwd: path.resolve("server"),
      env: { ...process.env, ...serverEnv },
      timeout: 60_000,
      stdio: "pipe",
    });
  } catch (cause) {
    throw new Error(
      "Не удалось подготовить corporate-learning-e2e. Проверьте MongoDB: npm run db:up. Сначала выполните npm run build.",
      { cause },
    );
  }
}
