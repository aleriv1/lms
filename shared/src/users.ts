import { z } from "zod";

import { assignmentSchema } from "./assignments.js";
import {
  emailSchema,
  isoDateTimeSchema,
  objectIdSchema,
  paginationQuerySchema,
  searchQuerySchema,
  sortQuerySchema,
} from "./common.js";
import {
  GROUP_NAME_MAX_LENGTH,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
} from "./constants.js";
import { userRoleSchema, userStatusSchema } from "./enums.js";

export const nameSchema = z
  .string()
  .trim()
  .min(NAME_MIN_LENGTH, `Имя не короче ${NAME_MIN_LENGTH} символов`)
  .max(NAME_MAX_LENGTH, `Имя не длиннее ${NAME_MAX_LENGTH} символов`);

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Пароль не короче ${PASSWORD_MIN_LENGTH} символов`)
  .max(PASSWORD_MAX_LENGTH, `Пароль не длиннее ${PASSWORD_MAX_LENGTH} символов`)
  .regex(PASSWORD_PATTERN, "Пароль должен содержать букву и цифру");

/** Группа — необязательная строка; пустое значение хранится как `null` (ТЗ, 4.1). */
export const groupNameSchema = z
  .string()
  .trim()
  .max(GROUP_NAME_MAX_LENGTH)
  .transform((value) => (value === "" ? null : value))
  .nullable();

/**
 * Пользователь в ответах API. `passwordHash` не возвращается никогда
 * (ТЗ, 10.3), поэтому его нет в контракте.
 */
export const publicUserSchema = z.object({
  id: objectIdSchema,
  name: z.string(),
  email: z.string(),
  role: userRoleSchema,
  groupName: z.string().nullable(),
  status: userStatusSchema,
  lastLoginAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type PublicUser = z.infer<typeof publicUserSchema>;

/** PATCH /users/me. Роль и статус пользователь себе менять не может (ТЗ, 4.1). */
export const updateProfileBodySchema = z.object({
  name: nameSchema,
  email: emailSchema,
});
export type UpdateProfileBody = z.infer<typeof updateProfileBodySchema>;

/** PATCH /users/me/password. Смена требует текущего пароля (ТЗ, 7.9). */
export const changePasswordBodySchema = z
  .object({
    currentPassword: z.string().min(1, "Введите текущий пароль"),
    newPassword: passwordSchema,
    newPasswordConfirm: z.string(),
  })
  .refine((data) => data.newPassword === data.newPasswordConfirm, {
    path: ["newPasswordConfirm"],
    message: "Пароли не совпадают",
  });
export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>;

export const USER_SORT_FIELDS = ["name", "email", "createdAt", "lastLoginAt"] as const;
export const userSortFieldSchema = z.enum(USER_SORT_FIELDS);

/** GET /admin/users — поиск по имени и email, фильтры, сортировка, пагинация (ТЗ, 7.14). */
export const adminUsersQuerySchema = paginationQuerySchema
  .extend(searchQuerySchema.shape)
  .extend(sortQuerySchema.shape)
  .extend({
    role: userRoleSchema.optional(),
    status: userStatusSchema.optional(),
    groupName: z.string().trim().max(GROUP_NAME_MAX_LENGTH).optional(),
    sortBy: userSortFieldSchema.default("createdAt"),
  });
export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;

export const adminUserListItemSchema = publicUserSchema.extend({
  activeAssignmentsCount: z.number().int().min(0),
});
export type AdminUserListItem = z.infer<typeof adminUserListItemSchema>;

/** GET /admin/users/:userId — карточка пользователя с его назначениями (ТЗ, 7.14). */
export const adminUserDetailSchema = publicUserSchema.extend({
  assignments: z.array(assignmentSchema),
});
export type AdminUserDetail = z.infer<typeof adminUserDetailSchema>;

/**
 * PATCH /admin/users/:userId. Пароль в административной форме не задаётся (ТЗ, 7.14);
 * запрет на понижение и блокировку собственной учётной записи проверяет сервер (ТЗ, 4.1).
 */
export const adminUpdateUserBodySchema = z.object({
  name: nameSchema,
  role: userRoleSchema,
  groupName: groupNameSchema,
  status: userStatusSchema,
});
export type AdminUpdateUserBody = z.infer<typeof adminUpdateUserBodySchema>;
