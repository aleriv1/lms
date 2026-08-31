/**
 * Числовые границы контракта. Значения со ссылкой на раздел взяты из ТЗ;
 * помеченные как «доопределено» ТЗ не задаёт, они зафиксированы здесь,
 * чтобы клиент и сервер валидировали одинаково.
 */

/** Пагинация и поиск (ТЗ, 5.4). */
export const PAGE_SIZES = [10, 20, 50] as const;
export const DEFAULT_PAGE_SIZE = 10;
export const DEFAULT_PAGE = 1;
export const SEARCH_DEBOUNCE_MS = 500;
export const SEARCH_MAX_LENGTH = 120;

/** Пользователь (ТЗ, 7.2). */
export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 80;
export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
/** Минимум одна буква и одна цифра (ТЗ, 7.2). */
export const PASSWORD_PATTERN = /^(?=.*[A-Za-zА-Яа-яЁё])(?=.*\d).+$/;
/** Группа — необязательная текстовая характеристика (ТЗ, 4.1); доопределено. */
export const GROUP_NAME_MAX_LENGTH = 60;

/** Курс (ТЗ, 7.12). */
export const COURSE_TITLE_MIN_LENGTH = 3;
export const COURSE_TITLE_MAX_LENGTH = 120;
export const COURSE_CATEGORY_MIN_LENGTH = 2;
export const COURSE_CATEGORY_MAX_LENGTH = 60;
export const COURSE_SHORT_DESCRIPTION_MIN_LENGTH = 20;
export const COURSE_SHORT_DESCRIPTION_MAX_LENGTH = 300;
export const COURSE_DESCRIPTION_MAX_LENGTH = 10_000;

/** Урок (ТЗ, 7.13). */
export const LESSON_TITLE_MIN_LENGTH = 3;
export const LESSON_TITLE_MAX_LENGTH = 150;
export const LESSON_CONTENT_MAX_LENGTH = 50_000;
export const LESSON_DURATION_MIN_MINUTES = 1;
export const LESSON_DURATION_MAX_MINUTES = 600;
export const LESSON_ORDER_MIN = 1;
export const LESSON_ORDER_MAX = 999;
/** Доопределено. */
export const RESOURCE_LINK_TITLE_MAX_LENGTH = 120;
export const RESOURCE_LINKS_MAX_COUNT = 20;
export const URL_MAX_LENGTH = 2048;

/** Тест и вопросы (ТЗ, 4.4); длины текстов доопределены. */
export const DEFAULT_PASSING_SCORE = 70;
export const PASSING_SCORE_MIN = 1;
export const PASSING_SCORE_MAX = 100;
export const TEST_TITLE_MIN_LENGTH = 3;
export const TEST_TITLE_MAX_LENGTH = 150;
export const QUESTION_TEXT_MIN_LENGTH = 3;
export const QUESTION_TEXT_MAX_LENGTH = 500;
export const QUESTION_OPTION_TEXT_MIN_LENGTH = 1;
export const QUESTION_OPTION_TEXT_MAX_LENGTH = 300;
export const QUESTION_OPTIONS_MIN_COUNT = 2;
export const QUESTION_OPTIONS_MAX_COUNT = 10;
export const TEST_QUESTIONS_MIN_COUNT = 1;
export const TEST_QUESTIONS_MAX_COUNT = 100;

/** Статистика (ТЗ, 7.8, 7.10, 7.15). */
export const ACTIVITY_CHART_WEEKS = 4;
export const ACTIVE_USER_WINDOW_DAYS = 30;
export const NEW_USERS_WINDOW_DAYS = 7;
export const RECENT_COURSES_LIMIT = 5;
export const RECENT_ACTIVITY_LIMIT = 20;

/** Разрешённые протоколы для всех внешних ссылок (ТЗ, 7.13). */
export const ALLOWED_URL_PROTOCOLS = ["http:", "https:"] as const;
