import { z } from "zod";

import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  EMAIL_MAX_LENGTH,
  PAGE_SIZES,
  SEARCH_MAX_LENGTH,
  URL_MAX_LENGTH,
} from "./constants.js";
import { apiErrorCodeSchema, sortOrderSchema } from "./enums.js";

/** Идентификатор MongoDB в виде строки: на границе API все `_id` уже сериализованы. */
export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Некорректный идентификатор");

/** Дата и время в ответах API — всегда строка ISO 8601 в UTC. */
export const isoDateTimeSchema = z.iso.datetime();

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Некорректный email").max(EMAIL_MAX_LENGTH));

/**
 * Внешняя ссылка: только `http` и `https` (ТЗ, 7.13). Проверка регулярным
 * выражением, а не через `URL`: пакет собирается и для браузера, и для Node.
 */
export const HTTP_URL_PATTERN = /^https?:\/\/[^\s/$.?#][^\s]*$/i;

export const httpUrlSchema = z
  .string()
  .trim()
  .max(URL_MAX_LENGTH)
  .regex(HTTP_URL_PATTERN, "Ссылка должна начинаться с http:// или https://");

/** Необязательная ссылка в форме: пустая строка равнозначна отсутствию значения. */
export const optionalHttpUrlSchema = z
  .union([httpUrlSchema, z.literal("")])
  .transform((value) => (value === "" ? null : value))
  .nullable();

/** Процент, рассчитанный сервером и округлённый до целого (ТЗ, 4.3). */
export const percentSchema = z.number().int().min(0).max(100);

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  pageSize: z.coerce
    .number()
    .int()
    .refine(
      (value) => (PAGE_SIZES as readonly number[]).includes(value),
      `Допустимые размеры страницы: ${PAGE_SIZES.join(", ")}`,
    )
    .default(DEFAULT_PAGE_SIZE),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const searchQuerySchema = z.object({
  search: z.string().trim().max(SEARCH_MAX_LENGTH).optional(),
});

export const sortQuerySchema = z.object({
  sortOrder: sortOrderSchema.default("desc"),
});

export const listMetaSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});
export type ListMeta = z.infer<typeof listMetaSchema>;

/** Единый конверт списочного ответа (ТЗ, 9.5). */
export const createListResponseSchema = <TItem extends z.ZodTypeAny>(
  itemSchema: TItem,
) =>
  z.object({
    items: z.array(itemSchema),
    meta: listMetaSchema,
  });

export type ListResponse<TItem> = {
  items: TItem[];
  meta: ListMeta;
};

export const fieldErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
});
export type FieldError = z.infer<typeof fieldErrorSchema>;

/** Единый формат ошибки API (ТЗ, 9.5). */
export const apiErrorSchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string(),
  fields: z.array(fieldErrorSchema).optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

/** Краткая ссылка на пользователя внутри других ответов. */
export const userRefSchema = z.object({
  id: objectIdSchema,
  name: z.string(),
});
export type UserRef = z.infer<typeof userRefSchema>;

/** Краткая ссылка на курс внутри других ответов. */
export const courseRefSchema = z.object({
  id: objectIdSchema,
  title: z.string(),
});
export type CourseRef = z.infer<typeof courseRefSchema>;
