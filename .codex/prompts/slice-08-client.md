# Slice 08 (client half) — taking a test

Read `AGENTS.md` first. It outranks this prompt. The specification outranks
both.

The server half of this slice is written, reviewed and accepted. You write the
client half only. **Do not touch anything under `server/` or `shared/`.**

## Goal

The learner takes a test, sees the result, and reaches the test from the two
screens that mention it (specification 7.6, 7.7). One new screen,
`/learning/tests/:testId`, plus the entry points slice 07 could not build
because the route did not exist.

Every figure on the result screen is computed by the server and displayed as it
arrives.

## Before you start — read the server, then stop if it disagrees

This prompt was written from `server/src/routes/learningTests.ts` — one file,
two handlers — and `.claude/specs/slice-08-server.md`. Read the route file and
confirm the paths, the answers and the refusals of the next section. Sections
6 and 7 of the spec state the rules behind them. Do not start the dev server and
do not open a browser (`AGENTS.md` 9).

If a route is missing, differently named, or answers a different shape:
**stop, write what you found to `.codex/reports/slice-08-client.md`, and hand
back without writing client code.**

## Given

- `shared/` is written and compiled. **Do not modify it.** This slice needs
  `learnerTestSchema`, `learnerQuestionSchema`, `submitAttemptBodySchema`,
  `attemptResultSchema` and the types `LearnerTest`, `LearnerQuestion`,
  `SubmitAttemptBody`, `AttemptResult`. Import them. If one looks wrong, stop
  and report — do not edit it.
- Slices 01–07 are accepted. `apiRequest`, `ApiError`, `toFormError`,
  `FormError`, the store, `ProtectedRoute`, the UI primitives (`Button`,
  `Modal`, `ProgressBar`, `Loader`, `EmptyState`, `ErrorState`),
  `formatDateTime` (`features/users/userFormat.ts`) and the whole
  `features/learning/` folder exist. Reuse them, do not write second copies.
- **Read these three files before writing anything.** Your work is their shape
  with different fields: `client/src/pages/LearningLessonPage.tsx` (the load
  effect, the four states, refusals rendered from `error.code`, the local
  `ActionError` block, the in-flight flag, the case-insensitive id comparison),
  `client/src/features/learning/learningSlice.ts` (the cache you are extending)
  and `client/src/features/tests/TestForm.tsx` (the house form idiom: RHF with
  `zodResolver`, `onSubmit` returning `Promise<FormError | null>` instead of
  throwing).

## The API you are building against

Both routes require the session cookie. **Neither checks a role** —
specification 4.3 assigns courses to any role, so the assignment decides.

| Method and path | Body | Answer |
|---|---|---|
| `GET /learning/tests/:testId` | — | `200` + `LearnerTest` |
| `POST /learning/tests/:testId/attempts` | `SubmitAttemptBody` | `201` + `AttemptResult` |

`201` on the attempt is specification 9.5, not a quirk: the attempt is a new
record and every attempt is kept (4.4).

Refusals you must render, all of them carrying a Russian `message`:

- `403 course_not_assigned` — the test's course is not assigned to this
  learner, the assignment was revoked, or the course is a draft.
- `403 lesson_locked` — the test belongs to a lesson the sequence has not
  opened. The direct-URL case, and the headline access risk of the slice.
- `403 forbidden` — **submitting** on an archived course. Reading it is allowed
  and answers `200`: specification 7.4 permits history and forbids new attempts.
- `404 not_found` — no such test, a test on a draft lesson, and any unparseable
  id in the path. A draft lesson's test answers `404` and not `403` on purpose:
  `403` would announce that something exists there.
- `409 conflict` — the attempt number could not be reserved. Rare, retryable.

## Words that repeat with different meanings

**Three things called "test".** `LearnerTest` — the questions, no `isCorrect`
anywhere, and there must be no place in your code where a correct answer could
be displayed even if the server sent one. `LearningTestRef` — the summary block
slice 07 already renders on the course and the lesson (`passed`, `bestScore`,
`attemptsCount`). `Test` / `CreateTestBody` — the teacher's editor, slice 05,
not yours.

**`attemptsCount` and `attemptNumber` are not the same number.**
`LearningTestRef.attemptsCount` is how many attempts exist; `AttemptResult.
attemptNumber` is the ordinal of the one just submitted. Never write one where
the other belongs.

**`score`, `passingScore`, `passed`.** All three arrive in `AttemptResult`.
Display `passed`; never derive it by comparing `score` with `passingScore`. The
server compares with `>=` and the client repeating the comparison is a second
source of truth for a rule the specification gives to the server (10.1).

## Decisions already made — implement, do not reconsider

1. **`/learning/tests/:testId` carries no `roles`.** Put it inside the existing
   `<Route element={<AppLayout />}>` under the plain `ProtectedRoute`, as a
   sibling of the other three `/learning` routes. Key the page component by
   `testId.toLowerCase()`, as `LearningLessonPage` keys itself.

2. **The entry into the test lives in `TestSummaryCard`,** which already renders
   in both places a test appears: `finalTest` on `LearningCoursePage` and
   `requiredTest` on `LearningLessonPage`. Give it one new prop,
   `canStart: boolean`, and when it is true render a `Link` to
   `/learning/tests/${test.id}` labelled «Пройти тест» when
   `test.attemptsCount === 0` and «Пройти тест ещё раз» otherwise. Both callers
   pass `course.courseStatus !== "archived"`; both already hold the course.
   Without this the new screen is reachable only by a hand-typed URL.

3. **The page loads the test first, then its course.** `LearnerTest` carries
   `courseId` and `lessonId` but no titles, and specification 7.7 requires the
   test's course and lesson on screen. So a second effect, depending on the
   loaded `test.courseId`, dispatches `fetchLearningCourse`; the lesson title is
   found in `course.lessons` by `lessonId`, compared with `toLowerCase()`. The
   course is a decoration and a guard, never a gate: while it is loading or if
   it failed, the questions still render and the header simply shows no titles.

4. **An archived course shows no form at all.** When the course has loaded and
   `courseStatus === "archived"`, render the test title and an `EmptyState`
   «Курс в архиве: новые попытки недоступны» with links back to the course and
   to `/learning`, and no questions and no submit control. The server refuses
   the submit anyway (`403 forbidden`); this is so the learner is not offered
   the work first. Decision 2 keeps this screen unreachable except by URL.

5. **One question at a time** (specification 7.7). The form shows «Вопрос N из
   M», a `ProgressBar` of the answered share, «Назад» and «Далее», and
   «Отправить ответы» on the last question only. Answers survive navigation in
   both directions. That percentage is the one number on these screens you may
   compute: it is form state, not a server figure — nothing on the server knows
   how far through the form the learner is.

6. **Radios for `single`, checkboxes for `multiple`,** as specification 7.7
   names them. Native inputs inside one `<fieldset>` per question with the
   question text as its `<legend>`, styled by the form's own CSS module. **Do
   not use the `Checkbox` primitive here and do not add a `Radio` primitive:**
   `Checkbox` is a standalone labelled field with its own error and required
   plumbing, an answer option is a row in a group, and mixing the two would make
   `single` and `multiple` questions look unlike each other for no reason.

7. **React Hook Form with `zodResolver(submitAttemptBodySchema)`**
   (`AGENTS.md` 6). Form values are
   `{ answers: { questionId: string; optionIds: string[] }[] }`, built in
   `defaultValues` from `test.questions` in the order the server sent them, one
   entry per question, `optionIds: []` for unanswered. One `Controller` per
   question at `answers.${index}.optionIds`. Do not pass `shouldUnregister` —
   its default is what keeps decision 5's answers alive while a question is
   unmounted.

8. **Unanswered questions are counted and confirmed** (specification 7.7). On
   «Отправить ответы», when at least one `optionIds` is empty, open the existing
   `Modal` saying how many questions are unanswered and asking for confirmation;
   the request goes out only after the confirming click. With none unanswered
   there is no modal and no extra click.

9. **The form cannot send a second request while the first is in flight, by any
   route.** This is the invariant of the slice, not a nicety: specification 11.3
   requires that a repeated click create no duplicate attempts, and the server
   deliberately does not de-duplicate — it has no idempotency key and two
   identical attempts in a row are legitimate (4.4). The client is the only
   place this requirement has left. So the guard is a flag checked at the top of
   the submit path — before the modal and before the request — **and** the
   button is `disabled` while the request is out. Both, not either: a disabled
   button does not cover a `submit` event that did not come from the button. The
   flag is released when the request settles, so a failed attempt can be
   retried.

10. **Every question is sent, unanswered ones with an empty `optionIds`.** Do
    not prune the body and do not renumber it; it mirrors the form. The server
    takes the denominator from its own snapshot, so a shorter body would change
    nothing — and a client that edits the body before sending is the shape of
    the bug where a wrong answer becomes a right one.

11. **After a passing attempt the course is re-read; after a failed one nothing
    is.** `attemptResultSchema` carries no course progress, no completion flag
    and no next lesson, and the contract will not change
    (`.claude/specs/slice-08-server.md` 7.3). A pass may have completed the
    lesson and the course, so on `passed === true` dispatch
    `fetchLearningCourse(courseId)` and, when `lessonId !== null`,
    `fetchLearningLesson({ courseId, lessonId })`. A failed attempt changes
    nothing on the server, so it triggers no reads.

12. **The result screen shows what `AttemptResult` carries and nothing else:**
    «N %» from `score`, the passing score, «Тест пройден» / «Тест не пройден»
    from `passed`, «Правильных ответов: correctCount из totalCount», «Попытка
    №attemptNumber», `formatDateTime(submittedAt)`. Plus one line that is not
    from the attempt: when the re-read course of decision 11 comes back with
    `assignmentStatus === "completed"`, a «Курс пройден» notice. **No course
    progress bar on this screen** — the course shows its own numbers when the
    learner returns to it.

13. **The result replaces the form; «Пройти ещё раз» brings the form back
    empty.** Attempts are unlimited (4.4). The retry control clears the stored
    result through a slice reducer, which unmounts the result and mounts a fresh
    form — that is what empties it, so do not reset fields by hand. The screen
    also links back to the lesson (when `lessonId !== null`) and to the course.
    A submitted attempt is never editable (7.7): no «Изменить ответы».

14. **Load refusals are rendered from `error.code`, and each one offers the way
    back.** `course_not_assigned` → `EmptyState` «Курс вам не назначен»;
    `lesson_locked` → `EmptyState` «Тест пока закрыт»; `not_found` →
    `EmptyState` «404 — Тест не найден»; anything else → `ErrorState` with a
    retry that re-dispatches the same thunk. **The back link of a failed load is
    `/learning` and only `/learning`:** the course id lives in the answer that
    did not arrive. **Never redirect to `/forbidden`** — the learner is in the
    right section with the wrong test, and the sidebar has to stay.

15. **Submit refusals go to a local `ActionError` block** in the
    `LearningLessonPage.tsx` shape, above the submit control, with the server
    message: `forbidden` (archived course), `conflict` (retryable), anything
    else. The answers stay on screen — a refused submit must not cost the
    learner the form. Branch on the code, never on the message (`AGENTS.md` 3).

16. **`learningSlice` holds the test and the attempt result; nothing else may.**
    Do not put learner test data in `testsSlice` — that is the teacher's
    catalogue, and a learner's screen overwriting it is a defect. Clear the
    stored result in `fetchLearnerTest.pending` and in `submitAttempt.pending`,
    so a result can never outlive the attempt it belongs to. Keep the
    case-insensitive id comparisons the file already uses.

17. **One rendering test, and it is required by the specification.**
    `AGENTS.md` 9 says rendering is not unit-tested here; specification 13 asks
    for a frontend test of at least one complex form, and the specification
    outranks `AGENTS.md` (`AGENTS.md` 1). This form is that form. Write
    `TestAttemptForm.test.tsx` with three cases, using `fireEvent` and
    `render` from `@testing-library/react` — **`@testing-library/user-event` is
    not installed and you may not install it**:
    - answers survive «Далее» and «Назад»;
    - the confirmation of decision 8 states the number of unanswered questions,
      and `onSubmit` runs only after the confirming click;
    - **double submission**: with `onSubmit` returning a promise that never
      settles, two clicks on the submit button plus one `fireEvent.submit` on
      the `<form>` produce exactly one `onSubmit` call. The `fireEvent.submit`
      is the case that matters — it bypasses the disabled button and so it is
      the only one that proves the flag of decision 9 rather than the `disabled`
      attribute.

## Files

New, under `client/src/features/learning/`:

- `TestAttemptForm.tsx`, `TestAttemptForm.module.css` — props
  `{ test: LearnerTest; onSubmit: (body: SubmitAttemptBody) => Promise<FormError | null> }`.
  Decisions 5–10 live here, and so does the guard of decision 9: the component
  owns the in-flight flag, not the page. The page's handler dispatches the thunk
  and returns the error or `null`, as `TestForm.tsx` does.
- `TestAttemptForm.test.tsx` — decision 17.

New, under `client/src/pages/`:

- `LearningTestPage.tsx`, `LearningTestPage.module.css` —
  `/learning/tests/:testId`. Header (test title, course title as a link, lesson
  title as a link when `lessonId !== null`, «Проходной балл N %»), the four
  load states, the archived branch of decision 4, the form, the result screen of
  decisions 12 and 13.

Edited, and only in the ways named:

- `learningApi.ts` — `requestLearnerTest(testId)` and
  `requestAttemptSubmit(testId, body)`, in the shape of the five that are there.
- `learningSlice.ts` — `test: { data: LearnerTest | null; status: LoadStatus;
  error: FormError | null }` and `attempt: { data: AttemptResult | null }` in
  the state; thunks `fetchLearnerTest(testId)` and
  `submitAttempt({ testId, body })`, each rejecting with `FormError`; one
  reducer clearing the stored result for decision 13.
- `learningSlice.test.ts` — two cases beside the existing ones:
  `submitAttempt.fulfilled` stores the result, and the new reducer clears it.
- `TestSummaryCard.tsx`, `TestSummaryCard.module.css` — the `canStart` prop and
  the link of decision 2.
- `LearningCoursePage.tsx`, `LearningLessonPage.tsx` — pass `canStart` to
  `TestSummaryCard`. Nothing else on these two pages changes; the lesson page
  keeps its line «Урок завершается прохождением теста» and still renders no
  completion button for a lesson with a test.
- `App.tsx` — the route of decision 1.

Nothing else. In particular `store/index.ts` and `components/ui/index.ts` do not
change: the reducer is already registered and no new primitive is added.

## Not in this slice — do not add it

- A history of attempts, a review of which answers were wrong, a per-question
  verdict. The review of answers is Stage 2 (specification 18.2), the history
  arrives with the statistics of slice 09.
- A timer or an attempt limit. The specification has neither, and 4.4 expressly
  leaves attempts unlimited.
- **A warning when the learner leaves the page with answers unsent — and this
  one the specification does require.** 5.3 asks for it of every form, and no
  form in this project has it: `useBlocker` needs the data router and `App.tsx`
  still mounts `<BrowserRouter>`, so the plan migrates the router once and
  covers all six forms together (`.claude/slice-plan.md`, срез 13). Building it
  here would mean either migrating the router inside a slice about taking a
  test, or shipping a `beforeunload` that catches a closed tab and misses every
  in-app link — one form out of six, done half way. It stays out on purpose:
  the debt is the plan's and it is already written down, not a hole this prompt
  is opening.
- Shuffling questions or options. The server sends them in order and the
  attempt's snapshot has to match what the learner saw.
- The frontend test of a protected route, the second half of specification 13 —
  slice 11, together with the integration tests.
- `GET /learning/me/statistics`, `/admin`, anything on `testAttemptSummarySchema`
  — slices 09 and 12.
- New dependencies of any kind, `@testing-library/user-event` included.
- A client-side rule about who may open which test. `ProtectedRoute` and the
  server are the two checks that exist; a third one written in a page is a
  defect.
- Fixtures made by hand through the UI or the API (`AGENTS.md` 9). What the
  checklist needs comes from `npm run seed` or already exists.

If you need something beyond this list, stop and report instead of inventing it.

## Verification

The machine gate, once, at the end, from the repository root:

```
npm run typecheck && npm run lint && npm run build && npm run test
```

One line of result each in the report. Do not run `npm run seed`, do not start
`npm run dev`, do not open a browser (`AGENTS.md` 9).

## Hand over

Write `.codex/reports/slice-08-client.md` in the format of `AGENTS.md` 8 and end
it with a numbered `## Проверить руками` checklist for the developer: each item
naming the URL, the input, and the result that would mean success. Start it from
`/learning` under `student@lms.local` / `Password1`, reaching the test by the
links of decision 2 rather than by a typed URL — except in the items that are
about typed URLs.

What the seed gives that student: «Правила технической эксплуатации» — lesson 2
optional **with a test attached**; «Работа с диспетчерской системой» — one
required lesson and a **final test**. Both courses assigned.

Two things about the database the checklist has to say out loud, because the
developer will otherwise read them as defects in your work:

- **The developer's working database is not freshly seeded.** The review run
  left ten attempts on that student, a completed lesson «Журнал осмотров» and
  the assignment on «Работа с диспетчерской системой» in `completed`, and
  `npm run seed` does not undo any of it. Mark every item that needs a course
  nobody has finished as needing a fresh database — the developer knows how to
  raise one.
- **Two states cannot be reached on this seed at all,** and guessing at them is
  worse than recording them: there is no archived course anywhere (decision 4 is
  unverifiable in the product), and the only `multiple` question lives in a
  draft course assigned to nobody (so a full-set answer cannot be graded through
  the interface). Both are tails of slice 10 in `.claude/slice-plan.md`. Write
  them into the checklist as items whose result is «не воспроизводится на
  текущем сиде», not as items to skip silently.

Cover at least: the entry into the lesson test and into the final test from
their screens; a locked lesson's test opened by pasting its URL; navigation
between questions keeping the answers; the confirmation naming the number of
unanswered questions; a failing attempt leaving the lesson unfinished; a passing
attempt on the lesson test completing the lesson without a «Завершить урок»
button ever appearing; and «Пройти ещё раз» starting from an empty form.

Commit once, do not push, and stop.
