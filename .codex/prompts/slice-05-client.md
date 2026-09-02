# Slice 05 (client half) — tests

Read `AGENTS.md` first. It outranks this prompt. The specification outranks
both.

The server half of this slice is written, reviewed and accepted. You write the
client half only. **Do not touch anything under `server/` or `shared/`.**

## Goal

The author of a course builds a test: a title, a passing score, an optional
lesson it belongs to, and a list of questions with their options. Creating a
test happens inside a course, editing it on its own screen (specification 6,
7.17). The list of a course's tests lives on the course edit page next to the
list of lessons.

What makes this slice different from slice 04: the form holds an array inside
an array — questions, and options inside each question. React Hook Form does
not allow two `useFieldArray` hooks over the same nesting in one component; the
options array must live in a child component that receives `control`.

## Before you start — read the server, then stop if it disagrees

This prompt was written from `.claude/specs/slice-05-server.md` and from the
code that implements it. Read `server/src/routes/courseTests.ts`,
`server/src/routes/tests.ts` and `server/src/tests/testLink.ts` — three short
files — and confirm the routes, bodies and refusals of the next section. Do not
start the dev server and do not open a browser to do it (`AGENTS.md` 9).

If any route is missing, differently named, or answers a different shape:
**stop, write what you found to `.codex/reports/slice-05-client.md`, and hand
back without writing client code.**

## Given

- `shared/` is written and compiled. **Do not modify it.** This slice needs
  `testSchema`, `testSummarySchema`, `questionSchema`, `createTestBodySchema`,
  `updateTestBodySchema`, `questionInputSchema`, `questionOptionInputSchema`,
  the types `Test`, `TestSummary`, `CreateTestBody`, `UpdateTestBody`,
  `QuestionInput`, `QuestionType`, `CourseDetail`, and the constants
  `QUESTION_TYPES`, `DEFAULT_PASSING_SCORE`, `PASSING_SCORE_MIN`,
  `PASSING_SCORE_MAX`, `QUESTION_OPTIONS_MIN_COUNT`,
  `QUESTION_OPTIONS_MAX_COUNT`, `TEST_QUESTIONS_MIN_COUNT`,
  `TEST_QUESTIONS_MAX_COUNT`. Import them. If one looks wrong, stop and report
  — do not edit it.
- Slices 01–04 are accepted. `apiRequest`, `ApiError`, `toFormError`,
  `FormError`, the store, `coursesSlice` (`fetchCourse`,
  `state.courses.detail`), `ProtectedRoute`, `AppLayout` and the UI primitives
  exist. Do not rewrite them.
- **Read these four files before writing anything.** Your files are their shape
  with different fields: `client/src/features/lessons/lessonsSlice.ts`,
  `client/src/features/lessons/LessonForm.tsx`,
  `client/src/features/lessons/LessonList.tsx`,
  `client/src/pages/LessonCreatePage.tsx`. Follow their conventions —
  thunk per request, `FormError` returned out of `onSubmit`, `fallbackError`,
  `ActionError`, the loading / forbidden / not-found / error ladder — rather
  than inventing parallel ones.

## The API you are building against

All four routes require the session cookie and the role `teacher` or `admin`; a
course that belongs to another teacher answers `403`.

| Method and path | Body | Answer |
|---|---|---|
| `POST /courses/:courseId/tests` | `createTestBodySchema` | `201` + `Test` |
| `PATCH /courses/:courseId/tests/:testId` | `updateTestBodySchema` | `200` + `Test` |
| `DELETE /courses/:courseId/tests/:testId` | — | `204` |
| `GET /tests/:testId` | — | `200` + `Test` |

`GET /courses/:courseId` (already used by `fetchCourse`) now answers with a
real `tests: TestSummary[]`, and every `lessons[].testId` is real too: it is
the test attached to that lesson, or `null`.

Refusals you must render, all of them carrying a Russian `message`:

- `422` with `fields` — a body the schema or the handler rejects; `field` reads
  like `questions.0.options`, which is exactly the React Hook Form path.
- `409` — the lesson already has a test; the course already has a final test;
  the test is attached to another lesson.
- `404` — the test or the lesson is gone; `403` — the course is not yours.

## Decisions already made — implement, do not reconsider

1. **`PATCH` replaces the whole test.** `updateTestBodySchema` *is*
   `createTestBodySchema` — there are no partial bodies. Always submit every
   field: title, `lessonId`, `passingScore` and the full `questions` array. A
   body carrying only what changed detaches the test and resets its passing
   score.
2. **A question's `order` is its position, and the author never types it.**
   Render the position as text. `append` gets `order: fields.length + 1`; after
   every `append`, `remove` and `swap`, renumber the whole array through
   `form.setValue` on each question's `order`. Reordering is by "up" and "down"
   buttons, as in `LessonList`.
3. **Register `order` as a hidden input with `{ valueAsNumber: true }`.**
   `questionInputSchema.order` is `z.number()` — the one numeric field in
   `shared/` that does *not* coerce, unlike the lesson's `order` and
   `durationMinutes`. Left as a string it fails validation with a type message
   the author cannot act on.
4. **`lessonId` is a `Select` whose empty option means the final test of the
   course.** Register it with
   `{ setValueAs: (value) => (value === "" ? null : value) }` — `""` is not a
   valid ObjectId and the schema would reject it. Options come from
   `course.lessons`; disable a lesson whose `testId` is set and is not this
   test, and disable the empty option when `course.tests` already holds another
   test with `lessonId === null`. That prevents most `409`s; keep rendering the
   ones that still arrive.
5. **`passingScore` is one number input**, defaulting to
   `DEFAULT_PASSING_SCORE`, with `min` and `max` from `PASSING_SCORE_MIN` and
   `PASSING_SCORE_MAX`.
6. **Options are checkboxes, and switching a question to `single` unchecks
   nothing.** The schema says what is wrong ("Для вопроса с одним ответом
   правильный вариант должен быть один") and its message belongs under the
   options group, at path `questions.<index>.options`. Do not re-implement that
   rule in the component: one schema for the form and for the server is the
   point of this slice.
7. **Deleting a test lives in `TestList`**, behind a `Modal` confirmation, as
   deleting a lesson does. `TestEditPage` gets no delete button.
8. **After creating a test, navigate to `/manage/tests/<id>/edit`** — the move
   `LessonCreatePage` already makes.
9. **`TestEditPage` needs two loads**: the test from `GET /tests/:testId` and
   its course through `fetchCourse(test.courseId)`, because the lesson selector
   is built from the course. Render the form only when both are ready, and key
   it by the test id.

## Files

New, under `client/src/features/tests/`:

- `testsApi.ts` — `requestTest(testId)`, `requestTestCreate(courseId, body)`,
  `requestTestUpdate(courseId, testId, body)`,
  `requestTestDelete(courseId, testId)`. Same shape as `lessonsApi.ts`.
- `testsSlice.ts` — `TestsState = { detail: { test: Test | null; status:
  LoadStatus; error: FormError | null } }`, thunks `fetchTest`, `createTest`,
  `updateTest`, `deleteTest`, each rejecting with `FormError`; `updateTest`
  writes its answer into `detail`. Copy the structure of `lessonsSlice.ts`.
- `testLabels.ts` — `QUESTION_TYPE_LABELS: Record<QuestionType, string>`
  ("Один правильный ответ" / "Несколько правильных ответов").
- `questionOrdering.ts` — pure helpers, no React:
  `renumberQuestions<T extends { order: number }>(questions: T[]): T[]` and
  `canMoveQuestion(index: number, count: number, direction: "up" | "down"):
  boolean`.
- `questionOrdering.test.ts` — vitest, mirroring
  `features/lessons/lessonOrdering.test.ts`.
- `TestForm.tsx`, `TestForm.module.css` — props `{ defaultValues?:
  Partial<CreateTestBody>; submitLabel: string; onSubmit: (body:
  CreateTestBody) => Promise<FormError | null>; lessons:
  CourseDetail["lessons"]; isFinalTestTaken: boolean; onDirtyChange?: (isDirty:
  boolean) => void }`. Server `fields` are copied onto the form with
  `form.setError` and the general message into local state, exactly as
  `LessonForm` does.
- `QuestionFieldset.tsx` — one question: text, type, its options array, add and
  remove option, remove question, move up and down. Receives `control`,
  `register`, `errors`, `index` and the callbacks from `TestForm`. This is
  where the second `useFieldArray` lives.
- `TestList.tsx`, `TestList.module.css` — props `{ course: CourseDetail }`. A
  `Table` of the course's tests: title, what it is attached to (the lesson's
  title, or "Итоговый тест"), question count, passing score, a link to
  `/manage/tests/:testId/edit` and a delete button. `EmptyState` when there are
  none, and a link to `/manage/courses/:courseId/tests/new`.

New, under `client/src/pages/`:

- `TestCreatePage.tsx` — `/manage/courses/:courseId/tests/new`. Loads the
  course, renders `TestForm` with one empty question already in the array.
- `TestEditPage.tsx`, `TestEditPage.module.css` — `/manage/tests/:testId/edit`.

Edited, and only in the ways named:

- `client/src/App.tsx` — the two routes above, inside the existing
  `roles={["teacher", "admin"]}` block, next to the lesson routes.
- `client/src/store/index.ts` — register `testsReducer` as `tests`.
- `client/src/pages/CourseEditPage.tsx` and its `.module.css` — a `<TestList
  course={course} />` section directly after the lesson section.

Nothing else. In particular do not touch `LessonForm.tsx`: the lesson form's
own test picker is not part of this slice, and its hardcoded `testId: null` is
deliberate for now.

## Not in this slice — do not add it

- Anything a learner sees: taking a test, attempts, scoring (slice 08).
- Any state or route for `learnerTestSchema`, `submitAttemptBodySchema` or
  `attemptResultSchema` — they exist in `shared/` for slice 08.
- Detaching a test from the lesson's own form; publication rules that mention
  tests; test statistics.
- New UI primitives. If you need one, stop and report instead of inventing it.
- New dependencies. React Hook Form, `@hookform/resolvers`, Redux Toolkit and
  React Router are already there at their pinned versions.

## Verification

The machine gate, once, at the end, from the repository root:

```
npm run typecheck && npm run lint && npm run build && npm run test
```

One line of result each in the report. Do not run `npm run seed`, do not start
`npm run dev`, do not open a browser (`AGENTS.md` 9).

## Hand over

Write `.codex/reports/slice-05-client.md` in the format of `AGENTS.md` 8 and
end it with a numbered `## Проверить руками` checklist for the developer: each
item naming the URL, the input, and the result that means success. The seeded
course «Вводный инструктаж по охране труда» already carries one test on its
first lesson, so the checklist starts from `/manage/courses` and not from an
identifier the developer would have to dig out. Commit once, do not push, and
stop.
