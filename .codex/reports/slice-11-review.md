# Slice 11 — независимое layer-2 ревью

Проверена реализация `6210d40`, прочитаны AGENTS.md, задание ревью, отчёт slice-11 и ТЗ §13/§18. Проверены шесть HTTP-файлов, контрактный smoke test, harness и все тесты, названные в таблице соответствия §13. Использован навык test-writer. Из постоянного кода добавлены только два теста в разрешённые файлы.

## Мутации

Каждый итоговый мутационный прогон запускал только указанный файл: `npm run test -w server -- src/routes/<имя>.test.ts`. Красный результат ниже означает exit 1 с проваленным assertion, зелёный — exit 0. После каждого итогового прогона production-файл восстановлен через `git checkout -- <file>`; production diff относительно `6210d40` отсутствует.

| № | Фактическое изменение | Исходный результат и проваленный тест | После дополнения |
| --- | --- | --- | --- |
| 1 | В `auth.ts` отключена ветка blocked | Красный, 1/5: `refuses a blocked account`, ожидался 403, получен 200 | Дополнение не нужно |
| 2 | В `auth.ts` неизвестный email возвращает `unauthorized`, неверный пароль сохраняет `invalid_credentials` | Красный, 1/5: `refuses an unknown email exactly like a wrong password`, коды различаются | Дополнение не нужно |
| 3 | В `requireRole.ts` отключена проверка разрешённых ролей | Красный, 2/4: `checks catalogue and administration access for student` и `... for teacher`, ожидался 403, получен 200 | Дополнение не нужно |
| 4 | В `courses.ts` удаление запрещено только для archived, опубликованный курс можно удалить | Красный, 1/3: `creates a draft, reads, renames and publishes it, then refuses deletion`, ожидался 409, получен 204 | Дополнение не нужно |
| 5 | В `userAssignments.ts` при обнаружении активного назначения вместо отказа снимается уникальный индекс тестовой коллекции, затем создаётся второй active | Красный, 1/3: `assigns a course, refuses an active duplicate and persists revocation`, ожидался 409, получен 201 | Дополнение не нужно |
| 6 | `isAssignmentEffective` в `accessRules.ts` принимает revoked | **Зелёный, 3/3**, ни один тест не упал | Добавлен `refuses a revoked assignment in both the access rule and HTTP`; повтор мутации красный, 1/4: ожидался false, получен true |
| 7 | `computeLessonStates` в `lessonStates.ts` возвращает available для каждого урока | Красный, 1/3: `locks the second required lesson and reports 50 percent after completing the first`, ожидался 403, получен 200 | Дополнение не нужно |
| 8 | В `attemptScoring.ts` точное совпадение заменено на наличие любого правильного варианта | **Зелёный, 2/2**, ни один тест не упал | Добавлен `scores and stores multiple answers only for an exact selected set`; повтор мутации красный, 1/3: вместо score 0 / passed false / correctCount 0 получены 100 / true / 1 |
| 9 | В `learningTests.ts` запись всегда получает `attemptNumber: 1` | Красный, 1/2: `hides correct options and stores two separately numbered attempts with snapshots`, второй POST ожидал 201, получил 409 из-за уникального индекса | Дополнение не нужно |
| 10 | В GET `learningTests.ts` добавлен isCorrect в options и обойдена очищающая схема ответа | Красный, 2/2: `hides correct options and stores two separately numbered attempts with snapshots` и `allows reading an archived test but refuses a new attempt`; сырой JSON содержит isCorrect | Дополнение не нужно |

Особенности постановки мутаций:

- №5 требует обойти две защиты: проверку в handler и partial unique index. Простое удаление throw не разрешает дубль и потому не является заданной поведенческой мутацией. Индекс снимался только кодом временного handler в защищённой `corporate-learning-test`; следующий connectTestDatabase восстановил индексы до тестов. Production-модель не менялась.
- №6 маскируется фильтром `status: {$in: [active, completed]}` в `assignedCourse.ts`. Новый тест сначала доказывает HTTP 200 при active и HTTP 403 после сохранённого revoked в той же сессии, затем непосредственно проверяет правило. Одного дополнительного HTTP-запроса недостаточно для обнаружения именно этой мутации. Существующий `accessRules.test.ts` уже проверяет полный список эффективных статусов, но он не входил в предписанный изолированный прогон.
- №8: в исходном HTTP-файле нет неверного multiple-ответа. Новый единственный тест проверяет неполный набор, набор с лишним вариантом и точный набор в обратном порядке; фиксированные ожидания проверяются и в HTTP-ответе, и в сохранённой попытке. Существующий unit-тест точного совпадения проверен чтением, но не заменяет назначенный HTTP-файл.
- №10: добавление поля только до learnerTestSchema.parse не создаёт утечку — схема его удаляет. Для фактической утечки временно обойдена схема; проверка сырого JSON действительно её ловит.
- Две уже выполненные мутации из задания (каскад deleteMany и игнорирование intent) не повторялись.

## Три способа ложноположительного теста

1. **Ответ сравнивается с самим собой.** Тавтологий и snapshots живого вывода в проверенных файлах не найдено. В auth неизвестный email сравнивается с ответом неверного пароля, но у последнего независимо зафиксированы 401 и invalid_credentials; №2 это подтвердил. Аналогично отказ для отсутствующего курса привязан к независимо проверенным 403/course_not_assigned. Снимок первой попытки сравнивается после второго POST, причём до этого проверены его фиксированные поля: это проверка неизменности, а не самосравнение.
2. **Assertion не достигается.** В восстановленном дереве пропущенных тестов нет. HTTP-запросы await-ятся; signIn сам требует 200. beforeAll устанавливает соединение, beforeEach очищает БД, fixtures создаются с await. Условные assertions по ролям имеют конкретные строки it.each. В контрактной таблице каждый из 59 случаев проверяет success=true и success=false. У формы async-ожидания await-ятся, а spy проверяется с точным payload или числом вызовов.
3. **Успех по неверной причине.** Подмены ожидаемого 403 фактическим 401 нет: signIn проверяет успешный вход, затем проверяются и статус, и code. Перед каскадным удалением явно подтверждены один Lesson и один Test. Перед проверкой сохранности чужого назначения выполнен await create. Нулевые counts после запрещённых операций относятся к отказу создать данные; исходные курс/пользователь/тест созданы, а отсутствие попытки после отказа архива следует после успешного GET. Выжившая №6 объясняется дополнительной защитой запроса, №8 — отсутствующим отрицательным входом.

**Оставшаяся слабая проверка:** `auth.test.ts`, `registers a student and stores a hash without exposing it`, проверяет passwordHash только через toBeTruthy и отличие от пароля. Это не доказывает, что хеш позволяет проверить исходный пароль: произвольная непустая строка тоже удовлетворила бы этим двум assertions. Чтение auth.ts/password.ts подтверждает текущий вызов bcrypt.hash, но название теста сильнее его доказательства. Не исправлено: задание разрешает добавлять только тесты для выживших перечисленных мутаций.

## Harness

- **Guard действительно бросает ошибку.** В отдельном процессе задан `MONGODB_URI=mongodb://localhost:27017/slice-11-guard-probe`, запущен только `auth.test.ts`. Exit 1: `Test run refused: database "slice-11-guard-probe" must end with "-test"`. Провален beforeAll, все пять тел тестов пропущены из-за ошибки setup; успешным такой запуск не считается. Переменная не переносилась в последующие процессы.
- **До guard нет записи.** Прочитаны apiClient.ts, connect.ts и модели: autoCreate/autoIndex отключаются до mongoose.connect, явные createCollection/createIndexes идут после проверки имени. clearDatabase дополнительно требует databaseApproved и суффикс. После отрицательного запуска read-only `mongosh` вернул для guard-probe список коллекций `[]`.
- **Очистка всех семи коллекций.** Прочитаны семь await-ящихся deleteMany в Promise.all. Дополнительно через существующий harness выполнены connect → counts → clearDatabase → counts → disconnect, без новых fixtures. До: users=2, courses=1, lessons=0, tests=1, courseassignments=1, lessonprogresses=0, testattempts=0. После: все семь значений 0. Для трёх изначально пустых коллекций динамический замер подтверждает пустоту; наличие их deleteMany подтверждено чтением, отдельные данные ради проверки не создавались.
- **Seed не требуется.** Прочитаны setupTests, harness и семь файлов slice: fixtures создаются внутри тестов, beforeEach очищает коллекции, импорта seed нет. Полный gate прошёл после явной очистки всех семи коллекций без запуска seed.
- Вспомогательная попытка запустить harness через `tsx -e` завершилась до подключения из-за CJS/ESM exports. Та же проверка выполнена успешно через `node --import tsx --input-type=module`; файлов-скриптов не добавлено.

## Проверка каждой строки ТЗ §13

Каждая строка исходной таблицы проверена чтением названных тестов; итоговый gate подтвердил их выполнение.

| Строка ТЗ | Названные тесты и фактические assertions | Вердикт |
| --- | --- | --- |
| Результат теста и прогресс | `attemptScoring.test.ts`: `counts a multiple-answer question only on an exact match` требует correctCount 1/0/0 для exact/subset/superset; `rounds the score to a whole percentage` требует 67; `passes on exactly the passing score` требует score 50, passed true. `lessonStates.test.ts`: `counts only the required lessons` требует completed 1 / total 2; `rounds the percentage to a whole number` — 33/67/100; `reports zero for a course with no required published lesson` — 0 и незавершённый курс | Покрыто; по 13 unit-тестов в каждом файле |
| Регистрация, вход, неверные данные | `auth.test.ts`: `registers a student and stores a hash without exposing it` — 201, student/active, запись и /me; `signs in with an httpOnly cookie, reads the public user and logs out` — cookie, пользователь, 204 и последующий 401; `refuses an unknown email exactly like a wrong password` — 401/invalid_credentials; `refuses a %s account` — blocked/archived с фиксированными статусами и кодами | Строка покрыта; доказательство качества passwordHash ограничено, см. выше |
| Ролевой middleware | `requireRole.test.ts`: `calls next without an error for a listed role` проверяет один вызов без ошибки; `returns forbidden for an unlisted role` — AppError 403/forbidden; `returns unauthorized when request.user is absent` — 401/unauthorized. `roleAccess.test.ts`: `refuses the course catalogue without a session` и `checks catalogue and administration access for %s` — реальные статусы для трёх ролей | Покрыто, №3 подтверждает чувствительность HTTP-тестов |
| CRUD курса | `courses.test.ts`: `creates a draft, reads, renames and publishes it, then refuses deletion` — 201/draft, GET detail, новое название, published, отказ удаления и сохранённый курс; `deletes a draft and its children while retaining an unrelated assignment` — родителя нет, дети 1→0, постороннее назначение неизменно | Покрыто |
| Назначение | `userAssignments.test.ts`: `assigns a course, refuses an active duplicate and persists revocation` — 201, поля связей, 409, count 1, persisted revoked и Date; `refuses assigning a %s course` — 422/field courseId и отсутствие назначений для draft/archived | Покрыто |
| Неназначенный и чужой курс | `learningAccess.test.ts`: `refuses unassigned and nonexistent courses identically` — 403/course_not_assigned. `courses.test.ts`: `refuses another teacher's course` — 403/forbidden после успешного входа другого преподавателя. Дополнительные именованные сценарии learningAccess проверяют lesson_locked, 50% и lesson_test_required | Покрыто; чужой курс проверяется чтением, не всеми видами изменения |
| Отправка и сохранение попытки | `learningTests.test.ts`: `hides correct options and stores two separately numbered attempts with snapshots` — два 201, score 100/passed, номера 1/2, два документа, содержимое snapshot и неизменность первого; `allows reading an archived test but refuses a new attempt` — GET 200, POST 403/forbidden и count 0 | Покрыто; отрицательный multiple-сценарий добавлен этим ревью |
| Сложная форма и защищённый frontend-маршрут | `TestAttemptForm.test.tsx`: `keeps single and multiple answers when navigating in both directions` — состояния выбора и точный payload; `counts unanswered questions and sends all entries only after confirmation` — число 2, отсутствие отправки до подтверждения; `blocks double clicks and a direct submit event while the request is pending` — disabled и ровно один вызов | **Частично**: сложная форма покрыта, теста ProtectedRoute нет; проверены список клиентских тестов и поиск его использования |

Исходный отчёт честно называет отсутствие теста защищённого маршрута. §18.2 действительно относит полный набор §13 ко второму этапу, а §18 прямо говорит, что перенос не отменяет требования: для полного §13 эта строка остаётся недоделанной. Frontend не менялся в этом ревью.

## Итоговые команды на восстановленном дереве

- `npm run db:up` — exit 0, lms-mongo Running.
- `npm run typecheck` — exit 0, три workspace.
- `npm run lint` — exit 0.
- `npm run build` — exit 0; предупреждения Rollup об аннотациях Zod и chunk 525.51 kB, без ошибки сборки.
- `npm run test` — exit 0; server 197/197, 24 файла; client 64/64, 10 файлов; всего 261, пропусков нет.

Четыре итоговые команды выполнены по одному разу, последовательно typecheck → lint → build → test. Дополнительные изолированные прогоны выполнялись только для мутаций и guard согласно заданию. Все процессы завершились; MongoDB оставлена как общая инфраструктура. Dev-сервер, браузер, install и seed не запускались.

## Отступления и границы

- Первые попытки git checkout внутри песочницы получили отказ записи index.lock. Одновременно внешний процесс временно закоммитил рабочие мутации, затем изменил HEAD обратно на вариант без них. Эти промежуточные смешанные прогоны №2/№3 не использованы в таблице: после восстановления они повторены изолированно с успешным checkout вне песочницы. Эта сессия чужие коммиты не переписывала.
- Во время ревью внешние коммиты изменяли служебные документы. Перед сдачей diff server/src относительно `6210d40` содержит только два добавленных теста; runtime-код восстановлен.
- Требование буквально чистого status кроме файлов ревью не выполнимо без удаления исходного постороннего `.claude/settings.local.json`. Он сохранён вне коммита. В коммит ревью входят только этот отчёт и два тестовых файла.
- Не добавлены тест хеша и frontend-тест маршрута: первый отмечен как слабое доказательство вне перечисленных мутаций, второй — известный пробел полного §13 вне разрешённого объёма кода.

**Вердикт: не закрыт — мутационные пробелы №6/№8 устранены и gate зелёный, но полный §13 не выполнен (нет frontend-теста защищённого маршрута); проверка passwordHash также остаётся слабой.**

## Проверить руками

URL приложения не требуется: ревью относится к автотестам, данные приложения и seed не меняются.

1. Из корня репозитория выполнить `npm run test -w server -- src/routes/learningAccess.test.ts`. Успех: 4/4, включая сценарий отзыва назначения.
2. Из корня выполнить `npm run test -w server -- src/routes/learningTests.test.ts`. Успех: 3/3, включая точный набор multiple-ответов и сохранённые результаты.
3. При решении о полном выполнении §13 открыть `client/src/routes/ProtectedRoute.tsx` и список клиентских тестов. Успех последующей отдельной доработки: автоматический тест реально проверяет отказ/перенаправление защищённого маршрута; ручной просмотр страницы это требование не заменяет.
