# Slice 11 — остановка на предварительной сверке

## Выполнено

Прочитаны `AGENTS.md`, задание slice 11, разделы 9.5, 13 и 18 ТЗ,
обработчик отправки попытки и существующие тесты расчёта балла, прогресса,
ролевого middleware и правил назначения/доступа. Применён навык `test-writer`.
До написания кода обнаружено условие остановки из раздела задания
«Before you start». Slice не реализован и не предъявляется как завершённый.

## Расхождение с ожиданием

- `.codex/prompts/slice-11.md:179` требует HTTP 200 при успешной отправке
  попытки. `server/src/routes/learningTests.ts:262` явно отвечает HTTP 201
  после создания попытки. ТЗ §9.5 указывает 201 для создания.
  Обработчик не исправлялся; это расхождение задания с кодом, а не установленный
  дефект обработчика. Вывод получен чтением, HTTP-сценарий не запускался.

## Отступления и блокировка

В задании несовместимы два указания: строки 41–42 требуют при расхождении
с обработчиком остановиться и вернуть отчёт без кода; строки 46–49 требуют
написать тест на фактический ответ и отметить ошибку задания. Применено явное
условие предварительной остановки. Оно относится к расхождению с обработчиком;
изменять требования ТЗ или обработчик для его устранения не предлагается.
Перед продолжением нужно согласовать эти два указания и ожидаемый статус
отправки попытки с существующим HTTP 201.

Не созданы все восемь новых файлов: `testing/apiClient.ts`,
`routes/auth.test.ts`, `routes/roleAccess.test.ts`, `routes/courses.test.ts`,
`routes/userAssignments.test.ts`, `routes/learningAccess.test.ts`,
`routes/learningTests.test.ts`, `contracts/sharedContracts.test.ts`
(пути относительно `server/src`). Не изменены `server/tsconfig.build.json`,
`server/src/routes/users.ts`, `README.md`. Единственное изменение slice —
этот отчёт. Посторонний `.claude/settings.local.json` не затронут.

## Соответствие разделу 13 ТЗ

Таблица различает имеющиеся проверки и невыполненную интеграционную часть.

| Строка ТЗ §13 | Файл и названия тестов / состояние |
| --- | --- |
| Вычисление результата теста и прогресса | `server/src/learning/attemptScoring.test.ts`: `counts a multiple-answer question only on an exact match`, `rounds the score to a whole percentage`, `passes on exactly the passing score`; `server/src/learning/lessonStates.test.ts`: `counts only the required lessons`, `rounds the percentage to a whole number`, `reports zero for a course with no required published lesson`. Существующие файлы оставлены без изменений. |
| Регистрация, вход и отказ при неверных данных | Новый `auth.test.ts` не создан; HTTP-проверки не добавлены. Регистрация отсутствует и в перечне сценариев самого slice 11. |
| Ролевой middleware | `server/src/middleware/requireRole.test.ts`: `calls next without an error for a listed role`, `returns forbidden for an unlisted role`, `returns unauthorized when request.user is absent`. HTTP-часть `roleAccess.test.ts` не создана. |
| Основные CRUD-операции курса | `courses.test.ts` не создан. |
| Назначение курса | `server/src/admin/assignmentRules.test.ts`: `assigns a published course only`, `assigns to an active user only`, `revokes an active assignment only` проверяют чистые правила; HTTP-часть `userAssignments.test.ts` не создана. |
| Запрет доступа к неназначенному и чужому курсу преподавателя | `server/src/learning/accessRules.test.ts`: `answers for a draft course as it does for one not assigned`, `carries the codes the client branches on` проверяют чистые правила; HTTP-проверки в `learningAccess.test.ts` и `courses.test.ts` не добавлены. |
| Отправка теста и сохранение попытки | `learningTests.test.ts` не создан; обнаружено расхождение статуса ответа. |
| Frontend-тесты сложной формы и защищённого маршрута | `client/src/features/learning/TestAttemptForm.test.tsx`: `keeps single and multiple answers when navigating in both directions`, `counts unanswered questions and sends all entries only after confirmation`, `blocks double clicks and a direct submit event while the request is pending`. Проверка защищённого маршрута этим отчётом не подтверждается; полный frontend-набор отнесён ТЗ §18.2 к этапу 2 и исключён из slice 11. |

Контрактный smoke test, добавленный заданием сверх этого перечня, также не создан.

## Проверки

Обязательные команды выполнены один раз на неизменённом коде; результаты
фиксируют исходное состояние, а не успешную реализацию slice 11.

| Команда | Exit code |
| --- | --- |
| `npm run typecheck` | 0 |
| `npm run lint` | 0 |
| `npm run build` | 0 |
| `npm run test` | 0 — server: 116 тестов / 17 файлов; client: 64 теста / 10 файлов. |

До и после slice: 180 тестов в 27 файлах, добавлено 0. Это один запуск
неизменённого набора, а не два отдельных замера.

MongoDB, dev-сервер и браузер не запускались; seed и seed:reset не выполнялись.
Harness не создан, поэтому его требования к MongoDB не проверялись.

## Проверенные утверждения о существовавшем поведении

- Успешная отправка попытки отвечает 201 — прочитан обработчик
  `learningTests.ts:262`; подтверждено статическим чтением.
- Расчёт балла и прогресса уже имеет модульные проверки — полностью прочитаны
  `attemptScoring.test.ts` и `lessonStates.test.ts`; по 13 тестов, оба файла
  прошли в текущем запуске.
- Ролевой middleware проверяет разрешённую роль, запрещённую роль и отсутствие
  пользователя — прочитан `requireRole.test.ts`; все три теста прошли.
- Имеются чистые проверки назначения и учебного доступа — прочитаны
  `assignmentRules.test.ts` и `accessRules.test.ts`; по шесть тестов прошли,
  интеграционную проверку HTTP они не заменяют.
- Имеются три проверки формы отправки теста — прочитаны названия сценариев
  `TestAttemptForm.test.tsx`, все три прошли; это не проверка защищённого маршрута.

## Замечено вне объёма

Сборка завершилась с предупреждениями Rollup об аннотациях в Zod и размере
клиентского chunk более 500 kB. Исправления зависимостей и сборки не выполнялись.

## Проверить руками

Пункты ниже отложены до реализации harness; сейчас выполнять их как приёмку
slice 11 нельзя. URL приложения не нужен: это проверки команд из корня проекта.

1. После реализации в отдельном терминале PowerShell задать
   `$env:MONGODB_URI = 'mongodb://localhost:27017/slice-11-guard-probe'`
   и выполнить `npm run test` с работающей MongoDB. Использовать отдельное
   имя, не рабочую базу. Успех: ненулевой exit code, сообщение с именем
   `slice-11-guard-probe` и причиной отказа из-за отсутствия суффикса `-test`,
   без записи и очистки данных. Закрыть этот терминал после проверки.
2. После реализации, когда работа приложения с БД не нужна, выполнить
   `npm run db:down`, затем `npm run test` без переопределённого MONGODB_URI.
   Успех: ненулевой exit code и понятная ошибка подключения, без пропуска
   интеграционных тестов. Восстановить MongoDB командой `npm run db:up`.
