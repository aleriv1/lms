import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: z.coerce.number().int().positive(),
  MONGODB_URI: z.string().min(1),
  CLIENT_ORIGIN: z.url(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
});

export type Env = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  mongodbUri: string;
  clientOrigin: string;
  jwtSecret: string;
};

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const details = result.error.issues
    .map(
      (issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`,
    )
    .join("; ");

  throw new Error(`Invalid environment configuration: ${details}`);
}

export const env: Env = {
  nodeEnv: result.data.NODE_ENV,
  port: result.data.PORT,
  mongodbUri: result.data.MONGODB_URI,
  clientOrigin: result.data.CLIENT_ORIGIN,
  jwtSecret: result.data.JWT_SECRET,
};
