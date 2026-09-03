# Срез 08, серверная половина — ревью запуском

Дата: 2026-09-03. Проверяемая реализация: `e72ae4e`; рабочий HEAD:
`7623613` (`git log -3 --oneline`). Исправлений реализации нет.
Восемь решений раздела 12 серверной спеки не оценивались.

## 1. Гейт

- PASS — `npm run typecheck` → exit 0, shared/server/client.
- PASS — `npm run lint` → exit 0, замечаний нет.
- PASS — `npm run test` → exit 0; сервер: 15 файлов, 91 тест; клиент: 6 файлов, 29 тестов.
- PASS — `npm run build` → exit 0, три workspace; Vite: 276 modules transformed, built in 1.70s. Два предупреждения Rollup о расположении PURE-аннотаций внутри Zod.

## 2. Чек-лист самоотчёта

### Среда и способ вызова

`curl.exe -s -o NUL -w '%{http_code}' http://localhost:4000/api/health`
вернул `200`. Однако **после** успешной сборки оба запроса с cookie ученика
`GET http://localhost:4000/api/learning/tests/6a98a7fb2c8726c041533c83`
и `GET http://localhost:4000/api/learning/tests/6a98a7fb2c8726c041533c8f`
вернули `404 {"code":"not_found","message":"Запрашиваемый ресурс не найден"}`.
Это не подтверждает обещание brief, что работающий сервер обновится от сборки.

Поэтому таблица ниже относится к **собранному приложению**, вызванному через
Supertest: `import('./dist/app.js')`, штатный `connectToDatabase()`,
`supertest(app).get(...)` / `.post(...).send(body)` с cookie реального входа.
Это реальные HTTP-запросы и текущая Mongo, без моков. Команда прогона из
`server/`: `node .slice08-review.mjs probe > .slice08-console.log` → exit 0.
Те же два GET через собранное приложение вернули `200` с вопросами.
Временный прогон нужен также для разрешённого brief подсчёта запросов Mongoose;
код продукта для этого не изменялся. Процесс на 4000 не останавливался.

Для компактности точные пути запросов обозначены константами. Это значения
из текущей базы, а не идентификаторы, которые читателю надо искать:

| Обозначение | Точное значение |
| --- | --- |
| `C` | `/api/learning/courses/6a986bb4fe6812e522f3f5e6` |
| `L` | `/api/learning/courses/6a986bb4fe6812e522f3f5e6/lessons/6a98a7fb2c8726c041533c79` |
| `T` | `/api/learning/tests/6a98a7fb2c8726c041533c83` |
| `COMPLETE` | `/api/learning/lessons/6a98a7fb2c8726c041533c79/complete` |
| `FC` | `/api/learning/courses/6a98a7fb2c8726c041533c89` |
| `FT` | `/api/learning/tests/6a98a7fb2c8726c041533c8f` |
| `DT` | `/api/learning/tests/6a986bb4fe6812e522f3f5da` |

Тела запросов, использованные дословно:

```json
{
  "correctLesson": {"answers":[{"questionId":"6a98a7fb2c8726c041533c84","optionIds":["6a98a7fb2c8726c041533c85"]}]},
  "empty": {"answers":[]},
  "twoOptions": {"answers":[{"questionId":"6a98a7fb2c8726c041533c84","optionIds":["6a98a7fb2c8726c041533c85","6a98a7fb2c8726c041533c86"]}]},
  "wrongLesson": {"answers":[{"questionId":"6a98a7fb2c8726c041533c84","optionIds":["not-an-objectid"]}]},
  "correctFinal": {"answers":[{"questionId":"6a98a7fb2c8726c041533c90","optionIds":["6a98a7fb2c8726c041533c91"]}]}
}
```

В POST отправлялось значение соответствующего ключа, без внешнего объекта.
Авторизация, если не оговорено иное: `student@lms.local`, cookie после
`POST /api/auth/login` с `{"email":"student@lms.local","password":"Password1"}`.
Верные варианты получены административным GET теста; это отдельная сессия,
не ответ learner API.

Порядок намеренно изменён: сначала первая половина пункта 10 и неверная
попытка из brief §6.3, затем пункты 2–5. Поэтому правильная попытка урока
получила номер **2**, следующая пустая — **3**. Буквальные номера 1/2 из
исходного чек-листа в этих двух пунктах не воспроизводились; номер 1 уже занял
обязательный для ревью отрицательный сценарий. Счёт с нуля отдельно проверен
на итоговом тесте: 1, 2, 3.

1. **PASS** — `GET T` до первой попытки → `200`, `learnerTestSchema.safeParse(body).success === true`; поиск в сыром теле: `isCorrect=false`, `correct=false`, лишние ключи вариантов `[]`.
2. **PASS с указанным сдвигом номера** — `POST T/attempts`, `correctLesson` → `201`, `score:100`, `passed:true`, `correctCount:1`, `totalCount:1`, `attemptNumber:2`.
3. **PASS с указанным сдвигом номера** — `POST T/attempts`, `empty` → `201`, `score:0`, `passed:false`, `correctCount:0`, `totalCount:1`, `attemptNumber:3`; сравнение первой сохранённой попытки до/после последующих отправок → `unchanged:true` (команда в §5).
4. **PASS** — `POST T/attempts`, `twoOptions` → `201`, `score:0`, `passed:false`, `correctCount:0`, `totalCount:1`, `attemptNumber:4`.
5. **FAIL — утверждение чек-листа об ответе курса** — `GET C` → `200`, нужный урок `state:"completed",hasTest:true`, но у него нет `attemptsCount/bestScore/passed`, `finalTest:null`; `GET L` → `200`, `requiredTest:{passed:true,bestScore:100,attemptsCount:4,...}`. Статистика работает на другом указанном контрактом маршруте; подробности в §4.
6. **PASS для завершения; ранний доступ NOT CHECKED** — `GET FT` → `200`; до отправок `GET FC` → `active,100%,finalTest.attemptsCount:0`, обязательный урок уже `completed`; `POST FT/attempts`, `correctFinal` после пяти неверных попыток → `201,score:100,passed:true,attemptNumber:6`; `GET FC` и `GET /api/learning/me` → назначение `completed`, в `FC.finalTest` — `passed:true,bestScore:100,attemptsCount:6`. Доступ при незавершённых обязательных уроках этим не доказан.
7. **NOT CHECKED** — `GET C`, `GET FC` до мутаций → нет `state:"locked"`; административные `GET /api/courses/6a986bb4fe6812e522f3f5e6`, `/6a98a7fb2c8726c041533c89`, `/6a986bb4fe6812e522f3f5d0` (все с префиксом `/api/courses`) → нет подходящего теста заблокированного урока для ученика. Состояние не создавалось.
8. **PASS** — преподаватель: `GET /api/tests/6a986bb4fe6812e522f3f5da` → `200` с идентификатором; ученик: `GET DT` и `POST DT/attempts`, `empty` → оба `403 {"code":"course_not_assigned","message":"Курс вам не назначен"}`. Использован существующий неназначенный черновиковый курс, тот же, что в пункте 9.
9. **PASS** — администратор: `GET /api/courses/6a986bb4fe6812e522f3f5d0` → `status:"draft"`, тест `6a986bb4fe6812e522f3f5da`; ученик: `GET DT` и `POST DT/attempts`, `empty` → оба `403 course_not_assigned`.
10. **PASS** — `POST COMPLETE` без тела до зачёта → `422 {"code":"lesson_test_required","message":"Урок завершается прохождением теста"}`; после зачёта → `200 {"lessonId":"6a98a7fb2c8726c041533c79","courseId":"6a986bb4fe6812e522f3f5e6","status":"completed","courseProgressPercent":100,"courseCompleted":true,"nextLessonId":null}`.

## 3. Четыре дополнительные проверки brief §6

1. **Ответы до отправки не утекли в проверенном GET.** `GET T` → `200`.
   Над сырым `response.text` выполнены `/isCorrect/.test(raw)` и
   `/correct/i.test(raw)` → оба `false`. Над разобранным телом:
   `body.questions.flatMap(q => q.options.flatMap(o => Object.keys(o).filter(k => !['id','text'].includes(k))))`
   → `[]`. Фактические варианты:
   `[{"id":"6a98a7fb2c8726c041533c85","text":"Сразу после осмотра"},{"id":"6a98a7fb2c8726c041533c86","text":"В конце месяца"}]`.
   Это проверка тела ответа, не заключение о внутреннем маппере.
2. **На имеющихся курсах — восемь операций Mongoose, одна агрегация попыток.**
   Команда прогона: `node .slice08-review.mjs probe > .slice08-console.log`.
   На время каждого `GET C` и `GET FC` включён
   `mongoose.set('debug',(collection,method,...args)=>queries.push({collection,method,args}))`.
   В обоих случаях: `users.findOne`, `courseassignments.findOne`,
   `courses.findOne`, `users.find`, `lessons.find`, `lessonprogresses.find`,
   `tests.find`, `testattempts.aggregate` — **8**, несмотря на 3 против 1
   опубликованных уроков. В каждом курсе один тест. Дополнительно выполнен
   `findAttemptStats(new Types.ObjectId('6a986bb4fe6812e522f3f5c6'), ['6a98a7fb2c8726c041533c83','6a98a7fb2c8726c041533c8f','6a986bb4fe6812e522f3f5da'].map(id=>new Types.ObjectId(id)))`
   → **1** `testattempts.aggregate`, в `$match.testId.$in` все три ID;
   результат: тест урока `{passed:true,bestScore:100,attemptsCount:4}`,
   итоговый `{passed:true,bestScore:100,attemptsCount:6}`, тест без попыток
   отсутствует в Map. Это реальная агрегация существующих данных. Курс с
   несколькими тестами через HTTP не проверен: такого курса нет.
3. **Неверная попытка не завершила доступный урок.**
   `GET C` → урок `available`, `progressPercent:100`, назначение `completed`;
   `POST T/attempts`, `wrongLesson` → `201,score:0,passed:false,attemptNumber:1`;
   повторный `GET C` → тот же JSON целиком
   (`JSON.stringify(before) === JSON.stringify(after)` → `true`).
   `GET L` после отправки → `progressStatus:"not_started"`, тест
   `{passed:false,bestScore:0,attemptsCount:1}`. Проверить именно переход
   назначения `active → completed` на неудаче **теста урока** нельзя:
   назначение этого курса было завершено раньше. Дополнение на итоговом тесте:
   пять `POST FT/attempts`, `empty`, затем `GET FC` → всё ещё
   `assignmentStatus:"active",progressPercent:100,finalTest.passed:false`.
4. **Последовательные и одновременные отправки не разделили номер.**
   Три последовательных `POST FT/attempts`, `empty` → `201/201/201`,
   `attemptNumber:[1,2,3]`, разные ID. Затем одновременно запущены два
   отдельных HTTP-запроса Supertest через `Promise.all` с тем же методом,
   путём и телом → `201/201`, номера `[4,5]`, ID
   `6a993f939bb618b6e1dfe483` и `6a993f939bb618b6e1dfe488`.
   `TestAttempt.find({userId:new Types.ObjectId('6a986bb4fe6812e522f3f5c6'),testId:new Types.ObjectId('6a98a7fb2c8726c041533c8f')}).select('attemptNumber score passed').sort({attemptNumber:1}).lean()`
   после последующего зачёта → номера `[1,2,3,4,5,6]`, первые пять —
   `score:0,passed:false`, шестая — `score:100,passed:true`.
   `TestAttempt.collection.indexes()` → индекс
   `userId_1_testId_1_attemptNumber_1`, `unique:true`, ключ
   `{userId:1,testId:1,attemptNumber:1}`. Конкретное попадание в retry-ветку
   не трассировалось; успешная конкурентная пара не доказывает его сама по себе.

## 4. Дефекты

### Пункт 5 самоотчёта требует поля статистики в ответе, где их нет

Действие: после зачтённой попытки выполнен `GET C`.
Получен `200`; относящийся к тесту фрагмент ответа дословно:

```json
{"id":"6a98a7fb2c8726c041533c79","title":"Журнал осмотров: как заполнять","order":2,"durationMinutes":10,"isRequired":false,"state":"completed","hasTest":true}
```

На верхнем уровне `finalTest:null`. Пункт 5 раздела «Проверить руками» в
`.claude/reports/slice-08-server.md` обещает в этом ответе
`attemptsCount > 0`, `bestScore:100`, `passed:true` у теста урока.
Этих полей нет. Следующий `GET L` вернул их в `requiredTest`:
`{passed:true,bestScore:100,attemptsCount:4,...}`.

Последствие: разработчик, буквально следующий чек-листу, не сможет получить
обещанный результат и может принять верный ответ API за потерю статистики.
Это ошибка проверяемого утверждения самоотчёта; нарушения wire-контракта
данным ответом не обнаружено:
`learningCourseSchema.safeParse(courseBody)` и
`learningLessonSchema.safeParse(lessonBody)` оба вернули `success:true`.
Ни контракт, ни реализация не исправлялись.

Других дефектов реализации в выполненных запросах не обнаружено. Это не
утверждение о сценариях, перечисленных как NOT CHECKED.

## 5. Утверждение → проверка → результат

Каждая строка относится к этому прогону. Полные тела отправки и точные пути
заданы в §2; дополнительная трассировка — в §3.

| Утверждение | Команда / запрос / проверка | Результат |
| --- | --- | --- |
| Четыре гейта из самоотчёта зелёные | Четыре команды §1 | Все exit 0; 91 + 29 тестов |
| Наличие health 200 после сборки гарантирует новую версию API | `curl.exe -s -o NUL -w '%{http_code}' http://localhost:4000/api/health`; `npm run build`; авторизованные `GET http://localhost:4000` + `T` / `FT` | **Не подтвердилось:** health 200, сборка exit 0, оба GET 404 общего notFound; тот же GET через `supertest(app)` из dist — 200 |
| Исходный тест урока ещё не проходили | `GET L` перед отправками | `not_started`, `passed:false,bestScore:null,attemptsCount:0` |
| Исходное назначение технического курса завершено, диспетчерского — нет | `GET /api/learning/me` до отправок | Первое `completed,100%`; второе `active,100%`, обязательный урок 1/1 |
| Получение теста не раскрывает ключ правильности | `GET T`, три проверки сырого тела/ключей §3.1 | 200, false/false/[] |
| Верный, пустой и двойной single-ответ оцениваются ожидаемо | `POST T/attempts` с `correctLesson`, `empty`, `twoOptions` | 201; соответственно 100/true, 0/false, 0/false; количество верных 1,0,0 из 1 |
| Неверная попытка не завершает урок | `GET C`; `POST T/attempts wrongLesson`; `GET C`; `GET L` | JSON курса не изменился; урок `available/not_started`; ограничение по уже завершённому назначению — §3.3 |
| Зачёт завершает урок, complete перестаёт отказывать | `POST COMPLETE` до; `POST T/attempts correctLesson`; `GET C`; `POST COMPLETE` после | 422 lesson_test_required → урок completed → 200; процент остаётся 100 |
| Показатели теста урока лежат в ответе курса | `GET C` после отправок | **Не подтвердилось:** hasTest:true, finalTest:null, статистики урока нет |
| Показатели теста урока доступны в ответе урока | `GET L` после четырёх отправок | requiredTest: passed:true,bestScore:100,attemptsCount:4 |
| Незачёт итогового теста не закрывает активное назначение | Пять `POST FT/attempts empty`; `GET FC` | active,100%,passed:false,bestScore:0,attemptsCount:5 |
| Зачёт итогового теста при завершённых обязательных уроках закрывает назначение | `POST FT/attempts correctFinal`; `GET FC`; `GET /api/learning/me` | 201,100/true; completed и в курсе, и в карточке; показатели итогового 100/true/6 |
| Преподаватель может получить ID неназначенного ученику теста | `GET /api/tests/6a986bb4fe6812e522f3f5da`, cookie teacher | 200, ID совпал с DT |
| Ученик не читает и не сдаёт тест неназначенного черновикового курса | `GET DT`; `POST DT/attempts empty` | Оба 403 course_not_assigned |
| Неавторизованный запрос запрещён | `GET T`; `POST T/attempts empty`, без cookie | Оба 401 unauthorized |
| Отсутствующий тест и некорректный ID не дают 500 | GET и POST `/api/learning/tests/000000000000000000000000` и `/api/learning/tests/not-an-objectid` (у POST суффикс `/attempts`, тело empty) | Все 404 not_found; сообщения соответственно «Тест не найден» и «Страница не найдена» |
| Отсутствующее answers отвергается | `POST T/attempts {}` | 422 validation_error; fields[0]: answers, «Invalid input: expected array, received undefined»; локализация этого существующего контракта не исправлялась |
| Последовательные и конкурентные попытки имеют разные номера | Три POST FT последовательно, два через Promise.all; DB-чтение §3.4 | 1,2,3 и 4,5; разные ID; все 201; unique-индекс существует |
| Более поздние отправки не переписали первую сохранённую попытку | Сохранён результат `TestAttempt.findById('6a993f929bb618b6e1dfe3e0').lean()` сразу после создания; `JSON.stringify(firstSaved) === JSON.stringify(await TestAttempt.findById('6a993f929bb618b6e1dfe3e0').lean())` после следующих трёх отправок и complete | true; сравнивался весь документ, не только номер |
| Произвольная строка optionId хранится без ObjectId-cast | `POST T/attempts wrongLesson`; `TestAttempt.findById('6a993f929bb618b6e1dfe3e0').lean()` | 201,0/false; answers[0].optionIds — ["not-an-objectid"] |
| Снимок не получает лишние _id | Тот же DB-read; `Object.keys(doc.questionsSnapshot[0])`, `Object.keys(doc.questionsSnapshot[0].options[0])` | [questionId,text,type,order,options] и [optionId,text,isCorrect] |
| Число операций не выросло при 1 → 3 уроках; статистика нескольких тестов агрегируется вместе | Mongoose debug вокруг GET FC, GET C и findAttemptStats с тремя ID, §3.2 | 8/8; по одной aggregate; отдельный вызов на три теста — одна aggregate |
| Ответы проверенных маршрутов соответствуют shared | Во временном HTTP-helper каждый успешный ответ проверялся соответствующим `learnerTestSchema`, `attemptResultSchema`, `learningCourseSchema`, `learningLessonSchema`, `lessonProgressResponseSchema`, `learningOverviewSchema` или `testSchema`; ошибки — `apiErrorSchema.safeParse(body)` | 38 проверенных ответов собранного приложения, 38 success:true |

## 6. Что не проверено и почему

- Тест заблокированного урока, включая прямой POST: подходящего состояния нет
  для ученика (пункт 7). Каталог `GET /api/courses?pageSize=50` вернул
  `meta:{page:1,pageSize:50,total:3,totalPages:1}`; три административных GET
  курсов дали один тест на доступном необязательном уроке, один итоговый и
  один тест в неназначенном черновиковом курсе.
- Тест **черновикового урока** внутри назначенного опубликованного курса:
  в тех же административных ответах у всех draft-уроков `testId:null`.
  Пункт 9 проверяет черновиковый курс с опубликованным уроком; это не заменяет
  проверку скрытого урока.
- Ранний доступ к итоговому тесту, пока обязательный урок не завершён:
  `GET FC` до мутаций уже показал обязательный урок `completed`.
- Неверная попытка теста урока при незавершённом назначении и прогрессе ниже
  100%: `GET C` до мутаций уже показал `completed,100%`. Незавершённость самого
  необязательного урока и её сохранение на неудаче проверены.
- HTTP-курс с несколькими тестами: в каждом из трёх существующих курсов один
  тест. Отдельная реальная агрегация трёх ID проверена, но не подменяет этот
  отсутствующий HTTP-сценарий.
- Архивный курс: все три курса из каталога — published/published/draft.
  Решение о доступе к архиву не оспаривалось.
- Изменение теста после попытки и сохранность старого снимка при таком
  изменении: контент по заданию не редактировался. Проверено только сохранение
  снимка и неизменность документа при последующих отправках.
- Исчерпание трёх retry и фактическое получение 11000 в текущем конкурентном
  прогоне не проверены. Индекс и результаты двух одновременных HTTP-запросов
  проверены, принудительная гонка не создавалась.

Отступления от буквального хода brief: сборка выполнена один раз **перед** API,
как требует подготовка среды; остальные гейты — после прогона. Вместо
необновившегося процесса на 4000 использован scratch собранного приложения.
До положительного сценария выполнен отрицательный, поэтому номера пунктов
2–3 сдвинуты. Автоматический прогон API выполнен по прямому заданию этого
ревью; браузер, клиент и `npm run dev` не запускались.

`npm run seed`, создание курсов/уроков/пользователей и очистка данных не
выполнялись. Последствия запрошенного прогона остаются в текущей базе:
`TestAttempt.find({userId:new Types.ObjectId('6a986bb4fe6812e522f3f5c6'),testId:{$in:['6a98a7fb2c8726c041533c83','6a98a7fb2c8726c041533c8f']}}).select('testId attemptNumber score passed').sort({testId:1,attemptNumber:1}).lean()`
вернул 4 попытки теста урока и 6 итогового; `GET L` — завершённый урок;
`GET FC` — завершённое назначение. До прогона счётчики обоих тестов были 0
(baseline `GET L` и `GET FC`).

Scratch завершился с exit 0 после `mongoose.disconnect()`; временные
HTTP-listeners Supertest закрыты. Файлы `.slice08-review.mjs`,
`.slice08-state.json` (включая cookies), `.slice08-evidence.jsonl` и
`.slice08-console.log` удалены. В коммит входит только этот отчёт.

## Проверить руками

1. В своей серверной сессии загрузить актуальную сборку. Войти на `/login`
   как `student@lms.local` / `Password1`; запросить
   `http://localhost:4000/api/learning/tests/6a98a7fb2c8726c041533c83`.
   Успех: 200 с вопросом «Когда заполняется журнал осмотров?», а не общий 404.
2. На текущей базе открыть `/learning` → «Правила технической эксплуатации»
   → «Журнал осмотров: как заполнять». Проверить ответ
   `/api/learning/courses/6a986bb4fe6812e522f3f5e6/lessons/6a98a7fb2c8726c041533c79`.
   Успех: `progressStatus:completed`, `requiredTest.passed:true`,
   `bestScore:100`, `attemptsCount:4` (если после ревью новых попыток не было).
3. На `/learning` открыть «Работа с диспетчерской системой». Проверить ответ
   `/api/learning/courses/6a98a7fb2c8726c041533c89`.
   Успех: назначение `completed`, прогресс 100, `finalTest.passed:true`,
   `bestScore:100`, `attemptsCount:6` при отсутствии новых попыток.
