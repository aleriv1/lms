# Slice 11 — the automated tests of specification 13

Read `AGENTS.md` first. It outranks this prompt. The specification outranks
both.

This slice has no screens and no new behaviour. It writes the automated tests
specification 13 lists for stage 1, and it closes one mechanical duplicate.
Everything it adds is a test; the two production files it touches are named
below and change by three lines together.

## Goal

`npm run test` covers, by machine, the scenarios specification 13 names:
scoring and progress, signing in and being refused, the role middleware, course
CRUD, assigning a course, the refusal to reach an unassigned or someone else's
course, submitting a test and storing the attempt — plus a contract smoke test
over the schemas of `shared/`.

## Before you start — read these, then obey what they say

- `server/src/setupTests.ts` — it already primes the environment
  (`NODE_ENV=test`, a `JWT_SECRET`, and `MONGODB_URI` pointing at
  `mongodb://localhost:27017/corporate-learning-test`). `server/src/app.ts` and
  `server/src/config/env.ts` do **not** import `dotenv/config` — only
  `src/index.ts` and `src/scripts/seed.ts` do — so `server/.env` never reaches a
  test run and the developer's working database is never the test target.
- `server/src/app.ts` — exports `app`, an ordinary Express application. That is
  what `supertest` drives. `supertest` and `@types/supertest` are **already**
  devDependencies of `server`: install nothing.
- `server/src/db/connect.ts`, `server/src/models/` — the seven models are the
  seven collections a reset touches.
- The handlers you are testing: `routes/auth.ts`, `routes/courses.ts`,
  `routes/userAssignments.ts`, `routes/learning.ts`, `routes/learningTests.ts`,
  `middleware/requireRole.ts`, `learning/accessRules.ts`,
  `courses/courseAccess.ts`.
- `server/src/learning/attemptScoring.test.ts` and
  `server/src/learning/lessonStates.test.ts` — «расчёт балла и прогресса» of
  specification 13 is **already covered** by these. Do not rewrite them, do not
  duplicate them; name them in the report as the coverage of that line.

Stop and hand back **only** if something structural is missing — a route, a
model field or an export this prompt relies on does not exist. A different
status code, a different `code` string or a different message is **not** a
reason to stop: record the handler's answer in the test and list it under
«Расхождение с ожиданием». The rule below says the same thing; where the two
readings differ, this one wins.

## The rule that governs this whole slice

**A test asserts what the code does, not what this prompt guesses it does.**
Every status code and every `code` string below is a claim to be verified by
reading the handler first. Where the handler answers something else, the test
records the handler's answer and the report says the prompt was wrong.

**If a scenario reveals a defect, you do not fix it.** Write the test so it
documents the real behaviour, mark the scenario in the report under a heading
«Расхождение с ожиданием», and hand back. Changing a handler to make a test
pass is a review decision, not yours.

## Files

Write (new):

- `server/src/testing/apiClient.ts` — the shared harness.
- `server/src/routes/auth.test.ts`
- `server/src/routes/roleAccess.test.ts`
- `server/src/routes/courses.test.ts`
- `server/src/routes/userAssignments.test.ts`
- `server/src/routes/learningAccess.test.ts`
- `server/src/routes/learningTests.test.ts`
- `server/src/contracts/sharedContracts.test.ts`

Change: `server/tsconfig.build.json`, `server/src/routes/users.ts`,
`README.md`.

Do not touch `client/`, `shared/`, `server/src/scripts/seed.ts`, any handler,
any dependency or the lock file.

## Decisions already made — implement, do not reconsider

1. **The tests drive the real application in process.** `import request from
   "supertest"; import { app } from "../app.js";` — no mock, no separate
   server, no `dist`. A cookie session is carried by `request.agent(app)`.

2. **`server/src/testing/apiClient.ts` holds everything shared.** Exactly this
   surface, and nothing that knows about one particular test:

   ```ts
   export async function connectTestDatabase(): Promise<void>;
   export async function disconnectTestDatabase(): Promise<void>;
   export async function clearDatabase(): Promise<void>;
   export function api(): TestAgent;                 // request.agent(app)
   export async function signIn(email: string, password: string): Promise<TestAgent>;
   export const TEST_PASSWORD = "Password1";
   export async function createUser(overrides?: Partial<{
     email: string; name: string; role: "admin" | "teacher" | "student";
     groupName: string | null; status: "active" | "blocked" | "archived";
   }>): Promise<UserDocument>;
   ```

   `createUser` hashes `TEST_PASSWORD` with the real `hashPassword` and fills
   unique defaults, so two calls without arguments never collide on email.

3. **The harness refuses any database whose name does not end with `-test`.**
   Inside `connectTestDatabase`, after `connectToDatabase()`, read
   `mongoose.connection.name`; if it does not end with `-test`, `await
   mongoose.disconnect()` and throw an error that names the database and says
   the run was refused. Nothing is written before that check. This is not
   decoration: `clearDatabase` empties seven collections, and slice 10 exists
   because the developer's working database holds fixtures nobody can rebuild.

4. **Every test file has the same frame.** `beforeAll(connectTestDatabase)`,
   `afterAll(disconnectTestDatabase)`, `beforeEach(clearDatabase)`. Fixtures
   are built inside the test through the models and `hashPassword` — never
   through the seed, never through the UI. The flow *under* test always goes
   through HTTP.

5. **`npm run test` now needs MongoDB, and the README says so.** No in-memory
   server, no second command, no conditional skip: a test that silently skips
   when Docker is off is worse than one that fails. Add one sentence to the
   README section «Сборка и проверки»: `npm run test` requires a running
   MongoDB (`npm run db:up`) and uses the separate database
   `corporate-learning-test`, whose contents it deletes.

6. **`server/tsconfig.build.json` also excludes `src/testing/**`.** The harness
   is not a `*.test.ts` file, so today's exclusions would emit it into `dist`.
   `typecheck` keeps seeing it.

7. **`server/src/routes/users.ts` drops its private copy of
   `isDuplicateKeyError`.** The copy at line 22 is byte-for-byte the function
   already exported by `server/src/db/duplicateKey.ts` — verified, they are
   identical. Delete the local one, import the shared one. Nothing else in that
   file changes.

## The scenarios — write these, in this order

Order matters: if you run out of room, the last file is the one to leave for
the report to declare missing. Never thin all eight instead.

**`auth.test.ts`** — signing in and being refused (specification 13, 3.1).
Correct credentials answer 200 with the public user and set an `httpOnly`
session cookie. A wrong password is refused. An unknown email is refused **with
the same status and the same `code` as a wrong password** — assert that
equality explicitly, it is the anti-enumeration rule. A `blocked` account and an
`archived` account are refused. `GET /api/auth/me` is 401 without the cookie and
returns the same user with it. After `POST /api/auth/logout`, `/me` is 401
again. No response body anywhere carries `passwordHash`.

**`roleAccess.test.ts`** — the role middleware (specification 3.3).
`server/src/middleware/requireRole.test.ts` already covers the middleware as a
pure function; this file covers it over HTTP and must not repeat it.
Unauthenticated `GET /api/courses` is 401, a `student` is 403, a `teacher` and
an `admin` are 200. `GET /api/admin/users` is 403 for a teacher and 200 for an
admin. Assert the `code` of the refusals, not only the status.

**`courses.test.ts`** — course CRUD and ownership (specification 5.1, 5.2).
A teacher creates a course (it comes back a draft), reads it, renames it with
`PATCH`, publishes it. Deleting a published course is refused with
`course_delete_forbidden`. Deleting a **draft** course answers 204 and **its
lessons and tests are gone from the database** — build one lesson and one test
under the course through the models first, then assert both counts are zero
after the delete while a `CourseAssignment` row created for an unrelated course
is untouched. This scenario is the automated half of slice 10 decision 7, which
was deliberately left to a checklist. Another teacher's course: read the answer
`courses/courseAccess.ts` actually gives and assert it.

**`userAssignments.test.ts`** — assigning (specification 4.3, 8.5). An admin
assigns a published course to a student; a second **active** assignment on the
same pair is refused; revoking sets the status to `revoked`; a course that is
not published cannot be assigned. Take every code from the handler.

**`learningAccess.test.ts`** — the refusals and the progress percentage
(specification 4.2, 4.3). An unassigned course answers `403
course_not_assigned`, and **a course id that does not exist at all answers
exactly the same** — assert that equality; it is the rule that a guessed
identifier tells the learner nothing. The second required lesson while the first
is unfinished answers `403 lesson_locked`. Completing a lesson whose required
test has no passing attempt answers `422 lesson_test_required`. Finishing one of
two required lessons makes `GET /api/learning/courses/:courseId` report 50 —
computed by the server, with the request body carrying no number.

**`learningTests.test.ts`** — submitting and storing (specification 4.4). A
correct submission answers **201** with `passed: true` and the score the scoring
rule gives, and a `TestAttempt` row exists carrying `attemptNumber: 1` and a
filled `questionsSnapshot`. A second submission stores `attemptNumber: 2` and
leaves the first row in place. The learner's `GET /api/learning/tests/:testId`
carries **no `isCorrect` on any option** — assert it over the whole serialised
body, not field by field. Submitting on a course whose status is `archived` is
refused while reading it is not.

**`sharedContracts.test.ts`** — the contract smoke test. It lives under
`server/` and imports from `@lms/shared`, because that is the built package both
workspaces consume and because `shared` has no test runner and this slice adds
no dependency. For each schema of `shared/src` that describes a request body or
a response, one valid sample parses and one deliberately broken sample fails —
around thirty cases in `describe.each` or a table, one line each. This file is
last on purpose.

## Out of scope — do not write it

- Any client test, any change under `shared/`, any new dependency.
- `mongodb-memory-server`, testcontainers, fixture libraries, factories beyond
  `createUser`.
- The `shared/` tails of the slice plan (`.default()` in the update schemas,
  `DEFAULT_PASSING_SCORE`, `z.config(z.locales.ru())`) — they change a contract
  both workspaces read and they are not test work.
- `server/vitest.config.ts` staying outside `typecheck` — leaving it there is
  cheaper than the three config files a fix would cost.
- Fixing any handler. See «The rule that governs this whole slice».

## Verification

MongoDB must be running; start it with `npm run db:up` if it is not. The gate,
once, at the end, from the repository root:

```
npm run typecheck && npm run lint && npm run build && npm run test
```

Report the exit code of each command and the test counts before and after this
slice. Do not start `npm run dev`, do not open a browser (`AGENTS.md` 9). Do
not run `npm run seed` or `npm run seed:reset` at all — the tests build their
own fixtures, and the seed writes to the working database by default.

## Hand over

Write `.codex/reports/slice-11.md` in the format of `AGENTS.md` 8. It must
contain:

- A table mapping **each line of specification 13** to the test file and test
  names that cover it, including the two existing pure-logic files.
- A section «Расхождение с ожиданием» for every status or `code` where this
  prompt guessed wrong — empty is a valid answer, and say so if it is.
- A short `## Проверить руками`: the developer confirms the harness refuses a
  non-`-test` database and that `npm run test` fails with a legible message
  when MongoDB is down.

Commit once, do not push, and stop.
