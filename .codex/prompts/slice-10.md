# Slice 10 — the demo data set, the README, closing stage 1

Read `AGENTS.md` first. It outranks this prompt. The specification outranks
both.

This slice has no client half and no new screens. It makes the database of
specification 12 reproducible, writes the README of specification 10, and
closes two debts that belong to files this slice already opens.

## Goal

1. `npm run seed` fills an empty database with the full demo set of
   specification 12 — every state the acceptance checklists have been waiting
   for.
2. `npm run seed:reset` rebuilds that set from scratch on a database that
   already holds an older one.
3. `README.md` at the repository root lets a person who has never seen this
   project install it, run it, seed it, build it and test it, and lists the
   demo accounts.
4. Two tails in files this slice opens anyway: the build output stops carrying
   tests, and deleting a draft course stops orphaning its lessons and tests.

## Before you start — read these, then obey what they say

- `server/src/scripts/seed.ts` — what exists today (440 lines, six users,
  three courses, one assignment).
- `server/src/models/` — `User`, `Course`, `Lesson`, `Test`,
  `CourseAssignment`, `LessonProgress`, `TestAttempt`. **Every field you write
  must exist in the model.** Do not invent one, do not skip a required one.
- `server/src/statistics/pairProgress.ts`,
  `server/src/statistics/attemptSummaries.ts`,
  `server/src/learning/courseProgress.ts` — the readers. The seed exists to
  feed them, so the shape it writes is dictated by what they read. In
  particular: **progress is never a number you write.** A course is 40 % done
  because two of its five lessons have a completed `LessonProgress`, and
  `totalLearningMinutes` is the sum of `durationMinutes` over completed
  lessons. If you find yourself writing a percent into a document, you have
  misread something — stop and report.

If a model or a reader disagrees with this prompt, **stop, write what you found
to `.codex/reports/slice-10.md`, and hand back without writing code.**

## Files

Write: `README.md` (new, repository root), `server/tsconfig.build.json` (new).
Change: `server/src/scripts/seed.ts`, `server/package.json`, the root
`package.json`, `server/src/routes/courses.ts`. Verify without changing:
`server/.env.example`.

Do not touch `client/`, `shared/`, any other route, or any dependency.

## Decisions already made — implement, do not reconsider

1. **`npm run seed` stays additive and non-destructive.** It creates what is
   missing and skips what is there, exactly as today, printing one line per
   entity. It never deletes and never overwrites. The developer's working
   database holds hand-made fixtures from earlier slices; a seed that wipes
   them on a habitual command is a defect, not a convenience.

2. **`npm run seed:reset` is the destructive one, and it says so.** Root script
   `"seed:reset": "npm run seed:reset -w server"`, server script
   `"seed:reset": "tsx src/scripts/seed.ts --reset"`. With `--reset` the script
   first empties the seven collections it owns — `User`, `Course`, `Lesson`,
   `Test`, `CourseAssignment`, `LessonProgress`, `TestAttempt` — and then builds
   the full set. It **refuses and exits non-zero when `NODE_ENV` is
   `production`**, and it prints the name of the database it is about to empty
   before emptying it.

3. **Additive mode warns when it skipped something.** The seed is idempotent by
   «the email is there, move on», so a field added by a later slice never
   reaches an already-populated database — that is how `groupName` failed to
   appear in slice 06. When anything was skipped, the last line printed is a
   warning that an existing database is not upgraded and that `npm run
   seed:reset` is the way to get the current set. The README repeats it.

4. **The demo set of specification 12 is fixed below.** The titles of the three
   courses the specification names are kept; the wording of lessons and
   questions is yours, in the corporate-training register the specification
   requires (no public IT courses). Keep every existing email, name, group and
   the password `Password1` **byte for byte** — four acceptance checklists name
   them.

   **Users — twelve.** The six that exist today, unchanged, plus six more: four
   learners in «Смена А», one learner in «Смена В», one archived account.
   Twelve is not decoration: `PAGE_SIZES` starts at 10, and the pagination of
   `/admin/users` and `/admin/statistics` has never been seen with a second
   page. At least three **active** learners share «Смена А», so a group filter
   has more than one person to average over.

   **Courses — five.**
   - «Вводный инструктаж по охране труда» — `published`, the main course,
     **five published lessons** (specification 12 asks for at least five), each
     with `durationMinutes`. Lesson 3 carries a **single-choice** test; lesson 5
     carries a **multiple-choice** test whose correct answer is a set of two
     options — that is the only way specification 4.4's «the whole set must
     match» becomes reachable through the learner API. Lesson 5 is reachable
     only after the earlier ones, so `lesson_locked` finally has a test behind
     it.
   - «Правила технической эксплуатации» — `published`, three lessons, one final
     course test (`lessonId: null`).
   - «Работа с диспетчерской системой» — `published`, two lessons, **nobody is
     assigned to it**. An empty statistics table for a legitimate course is a
     state the client draws and no one has ever seen.
   - A `draft` course, two lessons, no assignments.
   - An `archived` course, two lessons and one test, **with one assignment in
     force** — «on an archived course a test opens but does not submit» is
     otherwise unprovable.

   **Assignments, progress, attempts.**
   - `student@lms.local` (Петров): «Вводный инструктаж» **completed** — every
     lesson complete, `status: "completed"`, `completedAt` set; «Правила
     технической эксплуатации» **in progress**, one lesson of three complete,
     so the interface finally shows a percentage that is neither 0 nor 100
     (specification 12 asks for exactly this learner). Assigned to the archived
     course as well.
   - `student2@lms.local` (Кузнецова): one **revoked** assignment on which two
     of five lessons were completed before revocation — a revoked assignment
     with non-zero progress, and the wording of slice 09 decision 6 has nothing
     to stand on without it.
   - The three «Смена А» learners: active assignments on the main course with
     different amounts of progress, none of them equal to each other.
   - Attempts: on the single-choice test of the main course
     `student@lms.local` has **three** attempts — the best is not the last (so
     `isBest` and `isLast` land on different rows), and at least one is
     `passed: false`. One more learner has a single passing attempt on the
     multiple-choice test. Every attempt is written with the full
     `questionsSnapshot` copied from the test document it belongs to, with
     `answers`, `correctCount`, `totalCount`, `score`, `passed` and
     `attemptNumber` consistent with each other and with the test's
     `passingScore`. **An attempt whose numbers contradict its snapshot is
     worse than no attempt at all.**
   - Dates: spread `submittedAt`, `completedAt` and the `LessonProgress`
     timestamps over the last three weeks, and keep at least two learners
     inside the 30-day window that `countActiveUsers` reads, so «активных
     пользователей» is neither everybody nor nobody.

5. **The README is written for a person, not for a grader.** Sections, in this
   order: what the project is (three sentences); requirements (Node 24 LTS,
   Docker for MongoDB); installation (`npm install` at the root, workspaces);
   the environment file — `server/.env.example` is copied to `server/.env`, and
   every variable explained in one line; the database (`npm run db:up` /
   `npm run db:down`, and the fact that `npm run dev` deliberately does not
   start it); seeding (`npm run seed`, `npm run seed:reset`, and decision 3's
   warning); running (`npm run dev`, the two ports); building and testing
   (`npm run build`, `npm run typecheck`, `npm run lint`, `npm run test`); the
   demo accounts as a table (email, role, group, what each one is good for)
   with the single password stated once and a sentence saying these credentials
   belong to the demo set and never to a production configuration
   (specification 12); a short API description — the route groups (`/api/auth`,
   `/api/users`, `/api/courses`, `/api/learning`, `/api/admin`), one line each,
   plus the error shape and the fact that the session is an `httpOnly` cookie.
   **No secret, no connection string with a password, no token in the README**
   (specification 10.2). Confirm that `server/.env.example` still holds no real
   secret and say so in the report.

6. **The build output stops carrying tests.** `server/tsconfig.json` is
   `include: ["src"]` and the tests live in `src`, so `npm run build` emits
   `dist/**/*.test.js` and `dist/setupTests.js`. Add
   `server/tsconfig.build.json` that extends `tsconfig.json` and excludes
   `src/**/*.test.ts` and `src/setupTests.ts`, and point **only** the `build`
   script at it. `typecheck` keeps using `tsconfig.json`, so the tests stay
   type-checked. `dist/` is in `.gitignore`, so nothing is deleted from the
   repository — this changes what a fresh build emits, and nothing else.

7. **Deleting a draft course deletes its lessons and tests.** `DELETE
   /courses/:courseId` (`server/src/routes/courses.ts`) removes one document
   and there are no model hooks, so lessons have been orphaned since slice 03
   and tests since slice 05. Delete the children **before** the course, both by
   `courseId`, so an interruption leaves a course without children rather than
   children without a course. Assignments, progress and attempts are not
   touched: only a draft can be deleted and a draft cannot be assigned — say
   that in a comment. **Write no test for it here.** The server suite is
   pure-logic unit tests only; there is no route suite to extend, a route test
   needs a live database, and the automated tests of specification 18.1 are
   slice 11's whole subject. The checklist covers it instead.

## Out of scope — do not write it

- Any client change, any change under `shared/`, any new dependency.
- A migration framework, a fixture library, a faker.
- Fixtures made by hand through the UI or the API (`AGENTS.md` 9).
- Rewriting additive mode into upsert-everything: decision 1 says what it does,
  and «догнать существующую запись» is exactly the destructive behaviour that
  `--reset` exists to keep separate.
- Touching the developer's default database. See below.

## Verification

The machine gate, once, at the end, from the repository root:

```
npm run typecheck && npm run lint && npm run build && npm run test
```

Then, and only against a **scratch database**, run the seed three times:

```
MONGODB_URI=mongodb://localhost:27017/lms-seed-check npm run seed
MONGODB_URI=mongodb://localhost:27017/lms-seed-check npm run seed
MONGODB_URI=mongodb://localhost:27017/lms-seed-check npm run seed:reset
```

The first fills it, the second must create nothing and must print the warning
of decision 3, the third must rebuild it. **Never run any of these without the
`MONGODB_URI` override** — the default database is the developer's working one
and holds fixtures that four checklists depend on. Report the exit code and the
last line of each run. Do not start `npm run dev`, do not open a browser
(`AGENTS.md` 9). If MongoDB is not running, start it with `npm run db:up`.

## Hand over

Write `.codex/reports/slice-10.md` in the format of `AGENTS.md` 8, ending with
a numbered `## Проверить руками` checklist. This one differs from every
checklist before it: the developer will run `npm run seed:reset` on their own
database first, so write it as **the acceptance pass of the whole of stage 1**,
in this order:

1. A cold start from the README alone: install, `.env`, `db:up`, `seed:reset`,
   `dev`. Anything the README fails to say is a defect in your own work — name
   it as one.
2. The states no checklist could reach until now, each naming the screen, the
   account and the number that proves it: a course in progress on `/learning`
   and `/profile`; a group holding several learners on `/admin/statistics`; a
   revoked assignment with non-zero progress; a published course nobody is
   assigned to; a second page of `/admin/users` and of `/admin/statistics`;
   `lesson_locked` on a lesson that carries a test; a multiple-choice question
   answered partially and then fully; a test on the archived course that opens
   but does not submit; a best attempt that is not the last on
   `/admin/statistics/users/:userId`.
3. Decision 7: create a draft course with one lesson and one test through the
   management screens, delete the course, and confirm through the interface
   that neither the lesson nor the test survives it. This is the one place the
   checklist asks the developer to make data — the seed has no throwaway draft
   to destroy, and nothing else in this slice does.
4. The response time of `GET /api/admin/statistics` on the full set, as a
   number, from the Network panel. Specification 11.2 caps it at one second and
   it has never been measured.

Commit once, do not push, and stop.
