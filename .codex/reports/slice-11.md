# Slice 11 — автоматизированные проверки этапа 1

## Выполнено

- Harness в `server/src/testing/apiClient.ts`: реальный Express app через supertest agent, cookie-сессия, подключение/отключение MongoDB, очистка семи коллекций. Уникальные пользователи создаются с настоящим bcrypt-хешем `Password1`. После подключения проверяется имя БД; без суффикса `-test` соединение закрывается и запуск отклоняется с указанием имени. Очистка также требует одобренное соединение.
- `auth.test.ts`: вход, httpOnly cookie, /me, выход, одинаковый отказ для неверного пароля и неизвестного email, blocked/archived, отсутствие passwordHash в сырых ответах; дополнительно регистрация.
- `roleAccess.test.ts`: каталог без сессии и для трёх ролей, административный список пользователей, коды отказов.
- `courses.test.ts`: создание черновика, чтение, переименование, публикация, отказ удаления опубликованного курса; физическое удаление урока и теста при удалении черновика, неизменность постороннего назначения; отказ другому преподавателю.
- `userAssignments.test.ts`: назначение, отказ активного дубля, сохранение отзыва и его времени, отказ назначения draft/archived.
- `learningAccess.test.ts`: одинаковый отказ для неназначенного и отсутствующего курса, блокировка второго обязательного урока, отказ завершения без обязательного теста, серверные 50% после одного из двух уроков. Тело запроса завершения — пустой объект, процент не передаётся.
- `learningTests.test.ts`: HTTP 201, 100% и passed, две отдельные попытки №1/№2, содержимое снимка и неизменность первой записи; отсутствие isCorrect во всём сериализованном GET-ответе; чтение архива разрешено, отправка запрещена и не создаёт попытку.
- `contracts/sharedContracts.test.ts`: 59 строк таблицы для схем тел запросов и ответов из собранного @lms/shared; каждая проверяет допустимый и повреждённый пример.
- В `server/tsconfig.build.json` исключён src/testing/**; typecheck продолжает проверять harness. В `users.ts` только удалена локальная копия isDuplicateKeyError и добавлен импорт из db/duplicateKey.ts. В README добавлена одна фраза о MongoDB и очистке corporate-learning-test.

Шесть HTTP-файлов находятся в server/src/routes. Список изменений совпадает с заданием плюс обязательный отчёт. Client, shared, seed, зависимости и lock-файл не менялись. Посторонний .claude/settings.local.json оставлен вне коммита.

## Отступления от задания и принятые решения

1. Параллельные файлы Vitest используют одну БД, а каждый beforeEach удаляет все данные. Чтобы файлы не удаляли fixtures друг друга, harness удерживает файловую блокировку в системной временной папке от подключения до отключения. Новых экспортов, коллекций или зависимостей нет; конфигурация Vitest не менялась. Ожидание ограничено 60 секундами, hook подключения — 120 секундами. После аварийного завершения процесса lock может остаться: ошибка называет путь; удалять его вручную следует только после проверки отсутствия другого запуска.
2. Отключены autoCreate/autoIndex до подключения; коллекции и индексы явно создаются после guard. Это обеспечивает запрет записи до проверки имени БД без изменения моделей.
3. Добавлен HTTP-тест регистрации в разрешённый auth.test.ts: регистрация прямо перечислена в ТЗ §13, хотя сценарии задания описывали только вход.
4. Контрактных случаев 59 вместо приблизительных тридцати: включены экспортируемые вложенные объекты ответа и псевдонимы схем. Query-схемы, enum и скалярные валидаторы не являются телами запросов или ответами и не входят в smoke test.
5. Предыдущий отчёт об остановке заменён текущим после исправления задания пользователем. Предыдущий коммит не переписывался; для реализации создаётся один новый коммит на текущей ветке, без push.

## Расхождение с ожиданием

Для исправленного задания расхождений статусов, кодов и сообщений не найдено. Успешная отправка попытки возвращает 201, как теперь указано в задании. Дефектов обработчиков проверяемые сценарии не выявили; поведение обработчиков не исправлялось.

## Что не выполнено

Все пункты реализации выполнены. Отказ при имени БД без -test и ошибка при выключенной MongoDB оставлены для ручной проверки согласно заданию; в этом запуске они не выполнялись. Frontend-тест защищённого маршрута не добавлялся: frontend исключён из slice, полный набор §13 отнесён ТЗ §18.2 к этапу 2.

## Соответствие каждой строке ТЗ §13

Пути относительно корня репозитория; названия — из тестов.

| Строка §13 | Файл и тесты |
| --- | --- |
| Расчёт результата теста и прогресса | Существующие `server/src/learning/attemptScoring.test.ts`: `counts a multiple-answer question only on an exact match`, `rounds the score to a whole percentage`, `passes on exactly the passing score`; `server/src/learning/lessonStates.test.ts`: `counts only the required lessons`, `rounds the percentage to a whole number`, `reports zero for a course with no required published lesson`. По 13 тестов, не переписывались. |
| Регистрация, вход, отказ при неверных данных | `server/src/routes/auth.test.ts`: `registers a student and stores a hash without exposing it`; `signs in with an httpOnly cookie, reads the public user and logs out`; `refuses an unknown email exactly like a wrong password`; `refuses a %s account` для blocked/archived. |
| Ролевой middleware | Существующий `server/src/middleware/requireRole.test.ts`: `calls next without an error for a listed role`, `returns forbidden for an unlisted role`, `returns unauthorized when request.user is absent`. HTTP: `server/src/routes/roleAccess.test.ts`, `refuses the course catalogue without a session`, `checks catalogue and administration access for %s` для student/teacher/admin. |
| Основные CRUD-операции курса | `server/src/routes/courses.test.ts`: `creates a draft, reads, renames and publishes it, then refuses deletion`; `deletes a draft and its children while retaining an unrelated assignment`. |
| Назначение курса | `server/src/routes/userAssignments.test.ts`: `assigns a course, refuses an active duplicate and persists revocation`; `refuses assigning a %s course` для draft/archived. |
| Запрет доступа к неназначенному и чужому курсу преподавателя | `server/src/routes/learningAccess.test.ts`: `refuses unassigned and nonexistent courses identically`; `server/src/routes/courses.test.ts`: `refuses another teacher's course`. Дополнительно learningAccess: `locks the second required lesson and reports 50 percent after completing the first`, `refuses lesson completion without a passing required test`. |
| Отправка теста и сохранение попытки | `server/src/routes/learningTests.test.ts`: `hides correct options and stores two separately numbered attempts with snapshots`; `allows reading an archived test but refuses a new attempt`. |
| Frontend-тесты сложной формы и защищённого маршрута | Существующий `client/src/features/learning/TestAttemptForm.test.tsx`: `keeps single and multiple answers when navigating in both directions`, `counts unanswered questions and sends all entries only after confirmation`, `blocks double clicks and a direct submit event while the request is pending` — 3 прошедших теста. Защищённый маршрут этим набором не покрыт; полный frontend-набор — этап 2 (§18.2). |

Дополнительный smoke test: `server/src/contracts/sharedContracts.test.ts`, `<имя схемы> > parses a valid sample and rejects a broken sample` — 59 случаев.

## Проверки

Машинный gate выполнен один раз после реализации, в порядке задания.

| Команда | Exit code и результат |
| --- | --- |
| npm run typecheck | 0, все workspace, включая новые тесты и harness |
| npm run lint | 0 |
| npm run build | 0 |
| npm run test | 0, server: 195 тестов / 24 файла; client: 64 теста / 10 файлов |

До slice: 180 тестов / 27 файлов (116 server + 64 client), фактический запуск предыдущего хода этой задачи. После: 259 тестов / 34 файла. Добавлено 79 тестов: 20 HTTP-сценариев и 59 контрактных случаев. Все прошли, пропусков нет.

npm run db:up — exit 0, контейнер lms-mongo уже работал. Браузер, dev-сервер, seed и seed:reset не запускались, fixtures создавались только в тестовой базе. Все запущенные команды завершились; MongoDB оставлена как общая инфраструктура. git diff --check — exit 0.

## Проверенные утверждения о существовавшем поведении

- Окружение тестов не читает server/.env — прочитаны setupTests/app/env и выполнен поиск dotenv/config в server/src; импорт только в index и seed. setupTests использует ??=, поэтому явное окружение терминала сохраняется; от неверной базы теперь защищает harness.
- Дубликат в users совпадал с общей функцией — прочитаны обе реализации до изменения; условия идентичны, diff users содержит только удаление и импорт.
- Расчёт балла и прогресса уже проверялся — прочитаны attemptScoring/lessonStates tests; существующие 26 тестов прошли, они не дублировались.
- Вход и отказы — прочитан auth.ts, подтверждено HTTP: 200 и cookie для входа, 401 invalid_credentials для неверного пароля/неизвестного email/архива, 403 account_blocked для блокировки; /me после выхода — 401 unauthorized. Проверяемые сырые тела ответов не содержат passwordHash.
- Роли защищают каталог и администрирование — прочитаны requireRole и монтаж роутеров; четыре новых HTTP-теста и три существующих unit-теста прошли.
- Курс создаётся черновиком и допускает публикацию с обязательным опубликованным уроком — прочитаны courses/publishRules; CRUD HTTP-тест прошёл.
- Удаление опубликованного курса запрещено, удаление черновика удаляет детей, чужой преподаватель получает отказ — прочитаны courses/courseAccess; подтверждены 409 course_delete_forbidden, 204 с проверкой количества детей 0 и сохранности постороннего назначения, 403 forbidden для чужого курса.
- Назначение/дубль/отзыв/непубликуемый курс — прочитаны userAssignments и assignmentRules; HTTP подтвердил 201, 409 assignment_exists, 200 со статусом revoked, 422 unprocessable для draft/archived; проверено хранение.
- Учебный доступ и прогресс — прочитаны assignedCourse, accessRules, learning и courseProgress; HTTP подтвердил одинаковые 403 course_not_assigned, 403 lesson_locked, 422 lesson_test_required и серверные 50% после завершения.
- Попытки создаются с HTTP 201, снимком и последовательными номерами — прочитан learningTests; HTTP и чтение TestAttempt подтвердили №1/№2 и сохранность №1.
- Правильные варианты скрыты в GET, архив допускает чтение и запрещает отправку — прочитаны learningTests/accessRules; проверка всего JSON и HTTP 200/403 forbidden прошли, запрещённая отправка не создала запись.
- Схемы доступны через собранный @lms/shared — прочитаны экспорты shared; все 59 пар допустимых/повреждённых примеров прошли.
- Автоинициализация Mongoose учитывает autoCreate/autoIndex при соединении — прочитана установленная реализация node_modules/mongoose/lib/model.js; автоматическое создание отключается до соединения, явное идёт после guard. Это статическая сверка; отрицательная проверка guard остаётся ниже.
- Три теста сложной формы уже существовали — прочитаны названия TestAttemptForm; текущий запуск подтвердил три успешных теста, файл не менялся.

## Замечено вне объёма

Сборка предупреждает об аннотациях Rollup внутри Zod и клиентском chunk более 500 kB. Те же предупреждения были в предыдущем запуске на исходном коде. Зависимости и разбиение сборки не менялись.

## Проверить руками

URL приложения не нужен: это проверки команд из корня репозитория. Выполнять по очереди, без другого запущенного набора тестов. Демо-данные не изменять.

1. **Защита имени БД.** При работающей MongoDB открыть отдельный PowerShell в корне проекта, задать `$env:MONGODB_URI = 'mongodb://localhost:27017/slice-11-guard-probe'`, выполнить `npm run test`, затем посмотреть `$LASTEXITCODE`. Успех: ненулевой код, ошибка называет slice-11-guard-probe и требует суффикс -test; интеграционные сценарии не начинают запись/очистку. При необходимости сравнить список коллекций этой отдельной базы до и после в своём MongoDB клиенте — новых коллекций быть не должно. Закрыть отдельный PowerShell, чтобы его переопределение MONGODB_URI не осталось в следующей проверке.
2. **MongoDB недоступна.** В период, когда приложение не использует БД, в новом PowerShell из корня выполнить `npm run db:down`, затем `npm run test` с обычным окружением тестов. Успех: `$LASTEXITCODE` ненулевой, вывод содержит Test database setup failed с причиной подключения и подсказкой npm run db:up, а не успешный запуск с условным пропуском интеграционных тестов. Ожидание ошибки подключения может занять около 30 секунд на файл; остальные файлы ожидают блокировку с ограничением 60 секунд. После завершения обязательно восстановить MongoDB: `npm run db:up`.
