import { z } from "zod";

import { emailSchema } from "./common.js";
import { nameSchema, passwordSchema, publicUserSchema } from "./users.js";

/** POST /auth/register (ТЗ, 7.2). Роль назначается сервером — `student`. */
export const registerBodySchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "Пароли не совпадают",
  });
export type RegisterBody = z.infer<typeof registerBodySchema>;

/**
 * POST /auth/login (ТЗ, 7.1). Пароль здесь не проверяется по правилам сложности:
 * форма входа не должна подсказывать требования к существующим учётным записям.
 */
export const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Введите пароль"),
});
export type LoginBody = z.infer<typeof loginBodySchema>;

/**
 * Ответ `POST /auth/register`, `POST /auth/login` и `GET /auth/me`.
 * Токен в теле не передаётся: сессия живёт в httpOnly cookie (ТЗ, 10.3).
 */
export const sessionResponseSchema = z.object({
  user: publicUserSchema,
});
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
