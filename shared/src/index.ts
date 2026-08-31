/**
 * Общий пакет контрактов LMS.
 *
 * Схемы Zod из этого пакета — единственный источник истины по формату обмена
 * между клиентом и сервером (ТЗ, 10.4). Их используют серверная валидация,
 * типы обеих сторон и валидация форм на клиенте. Дублировать эти определения
 * в `client/` или `server/` нельзя.
 */

export * from "./activity.js";
export * from "./assignments.js";
export * from "./auth.js";
export * from "./common.js";
export * from "./constants.js";
export * from "./courses.js";
export * from "./enums.js";
export * from "./learning.js";
export * from "./lessons.js";
export * from "./statistics.js";
export * from "./tests.js";
export * from "./users.js";
