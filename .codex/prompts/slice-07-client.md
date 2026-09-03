# Slice 07 (client half) — learning: courses, lessons, progress

Read `AGENTS.md` first. It outranks this prompt. The specification outranks
both.

The server half of this slice is written, reviewed and accepted. You write the
client half only. **Do not touch anything under `server/` or `shared/`.**

## Goal

The learner's half of the application: «Мое обучение» with the assigned
courses and the figures above them, the assigned course with its table of
contents and the state of every lesson, and the lesson itself with its
material and the completion action (specification 7.4, 7.5, 7.6).

Every number and every state on these screens is computed by the server and
displayed as it arrives.

## Before you start — read the server, then stop if it disagrees

This prompt was written from `server/src/routes/learning.ts` and
`.claude/specs/slice-07-server.md`. Read the route file — one file, five
handlers — and confirm the paths, the answers and the refusals of the next
section. Sections 5 and 6 of the spec state the rules the server enforces; read
them if a state on screen surprises you. Do not start the dev server and do not
open a browser (`AGENTS.md` 9).

If a route is missing, differently named, or answers a different shape:
**stop, write what you found to `.codex/reports/slice-07-client.md`, and hand
back without writing client code.**

## Given

- `shared/` is written and compiled. **Do not modify it.** This slice needs
  `learningOverviewSchema`, `learningCourseCardSchema`, `learningCourseSchema`,
  `learningLessonSchema`, `learningLessonItemSchema`, `learningTestRefSchema`,
  `lessonProgressResponseSchema` and the types `LearningOverview`,
  `LearningCourseCard`, `LearningCourse`, `LearningLesson`,
  `LearningLessonItem`, `LearningTestRef`, `LessonProgressResponse`,
  `LessonAccessState`, `LessonProgressStatus`. Import them. If one looks wrong,
  stop and report — do not edit it.
- Slices 01–06 are accepted. `apiRequest`, `ApiError`, `toFormError`,
  `FormError`, the store, `ProtectedRoute`, `AppLayout`, the UI primitives,
  `COURSE_STATUS_LABELS` and `COURSE_AUDIENCE_LABELS`
  (`features/courses/courseLabels.ts`), `ASSIGNMENT_STATUS_LABELS` and
  `formatDateTime` (`features/users/userFormat.ts`) exist. Reuse them, do not
  write second copies.
- **Read these three files before writing anything.** Your files are their
  shape with different fields: `client/src/pages/AdminUserDetailPage.tsx` (a
  detail page: the load effect, the four states, refusals rendered from
  `error.code`, the case-insensitive id comparison),
  `client/src/features/courses/coursesSlice.ts` (thunk per request, `LoadStatus`,
  writing an answer into the cache instead of refetching) and
  `client/src/features/lessons/LessonList.tsx` (the local `ActionError` block
  and the in-flight flag). Follow those conventions rather than inventing
  parallel ones.

## The API you are building against

All five routes require the session cookie. **None of them checks a role** —
specification 4.3 assigns courses to any role, so a teacher or an administrator
with an assignment is a learner here.

| Method and path | Body | Answer |
|---|---|---|
| `GET /learning/me` | — | `200` + `LearningOverview` |
| `GET /learning/courses/:courseId` | — | `200` + `LearningCourse` |
| `GET /learning/courses/:courseId/lessons/:lessonId` | — | `200` + `LearningLesson` |
| `POST /learning/lessons/:lessonId/start` | — | `200` + `LessonProgressResponse` |
| `POST /learning/lessons/:lessonId/complete` | — | `200` + `LessonProgressResponse` |

Both actions take **no body** and answer `200`, never `201`: the row may be
created or updated and a repeated click has to be harmless (specification 5.3).
The action path carries the lesson only — the course is the server's business.

Refusals you must render, all of them carrying a Russian `message`:

- `403 course_not_assigned` — the course is not assigned, the assignment was
  revoked, or the course is a draft. The same answer for a course that does not
  exist by that id, on purpose.
- `403 lesson_locked` — the lesson is closed by the sequence. This is the
  direct-URL case and it is the headline risk of the slice.
- `403 forbidden` — an action on an archived course (reading it is allowed).
- `404 not_found` — no such lesson in this course, a draft lesson, and any
  unparseable id in the path.
- `422 lesson_test_required` — the lesson has a test attached and no passing
  attempt exists.

## Words that repeat with different meanings

Read this section twice; it is where this slice is easy to get wrong.

**Four statuses, none of them the same.** `courseStatus`
(`draft | published | archived`, `COURSE_STATUS_LABELS`); `assignmentStatus`
(`active | revoked | completed`, `ASSIGNMENT_STATUS_LABELS`); the lesson row's
`state` (`completed | available | locked`) — the access state, new labels;
`progressStatus` of the open lesson (`not_started | in_progress | completed`) —
new labels. The learner never sees `LESSON_STATUS_LABELS` (`draft | published`):
an unpublished lesson does not reach these screens at all.

**Three `nextLessonId`, two meanings.** `LearningCourse.nextLessonId` and
`LessonProgressResponse.nextLessonId` are the same thing — the first available
unfinished lesson of the course, the target of «Продолжить обучение», `null`
when there is none. `LearningLesson.nextLessonId` is something else: the nearest
**open** neighbour after the lesson you are reading, with `previousLessonId` its
mirror. Never write one into the other. The neighbour ids are already filtered:
the server refuses to hand you the id of a lesson it would then refuse to open.

**`completedLessonsCount` and `requiredLessonsCount`** are the numerator and
the denominator of `progressPercent` — required published lessons only. Display
the pair; do not divide it. Optional lessons are in the table of contents and in
neither count.

## Decisions already made — implement, do not reconsider

1. **The three routes carry no `roles`.** Put them inside the existing
   `<Route element={<AppLayout />}>` under the plain `ProtectedRoute`, as
   siblings of `/profile`. An administrator or a teacher who opens `/learning`
   and has no assignment sees the empty state, not `/forbidden`. Do not edit
   `navItems.ts` or `startPath.ts`: the student's sidebar already links to
   `/learning`, and the other roles reaching it by URL is intended.

2. **Nothing on these screens is recomputed** — not the percentage, the access
   state, «the course is finished» or which lesson comes next (`AGENTS.md` 5
   and 6, specification 10.1). A value that is not in the answer is not yours to
   derive: report it instead.

3. **An action answer is written into the cache, and then the course and the
   lesson are refreshed.** `LessonProgressResponse` carries `status`,
   `courseProgressPercent`, `courseCompleted` and the course-level
   `nextLessonId` — write the first, the second and the fourth into the slice on
   `fulfilled` so the screen reacts at once. It does **not** carry the new
   access states, and it cannot: completing one required lesson can open two
   rows at once — the next required lesson and an optional lesson that stood
   behind it. So the page dispatches `fetchLearningLesson` and
   `fetchLearningCourse` again after a successful action and lets the server say
   what is open now. Both writes come from the server; neither is a client
   calculation.

4. **A refresh never blanks what is on screen.** In `pending` of the course and
   the lesson thunks, clear the cached entry **only** when the requested id
   differs from the loaded one; otherwise keep the data and set the status. A
   `Loader` is shown when the entry is `null`, never over data that is already
   correct. This is the defect that had to be fixed by review in slices 04 and
   05 — do not reproduce it here.

5. **The id from the path is compared to the loaded id with `toLowerCase()`,
   and a mismatch renders `Loader`, not `ErrorState`.** Both spellings of a
   hexadecimal id pass `objectIdSchema`, and between mounting and the first
   effect the store still holds the previous entity. `AdminUserDetailPage.tsx`
   is the pattern.

6. **Load refusals are rendered from `error.code`, and each one offers the way
   back.** `course_not_assigned` → `EmptyState` «Курс вам не назначен» with the
   server message and a link to `/learning`; `lesson_locked` → `EmptyState`
   «Урок пока закрыт» with a link to the course; `not_found` → `EmptyState`
   «404 — …» with a link back. Anything else → `ErrorState` with a retry that
   re-dispatches the same thunk. **Never redirect to `/forbidden`:** the learner
   is in the right section with the wrong course, and the sidebar has to stay.
   Action refusals go to a local `ActionError` block in the `LessonList.tsx`
   shape. Branch on the code, never on the message (`AGENTS.md` 3).

7. **The lesson material is HTML the server has already sanitised** — one
   whitelist, on write, in `server/src/lessons/sanitizeContent.ts`
   (specification 7.6, 10.3). Render it with `dangerouslySetInnerHTML` and one
   comment saying where the guarantee comes from. Do not add a sanitiser or a
   markdown renderer, and do not escape the markup into visible tags. `videoUrl`
   and `resourceLinks` are external links with
   `target="_blank" rel="noopener noreferrer"` — not an embedded player: there
   is no allowlist of players here and inventing one is out of scope.

8. **A lesson with `requiredTest` shows the test block and no completion
   button.** Specification 7.6 offers the test instead of a final completion,
   and the server refuses `complete` on such a lesson. Render the test — title,
   «Проходной балл N %», its result fields — plus the line «Урок завершается
   прохождением теста». No «Пройти тест» control: the test screens are slice 08
   and `/learning/tests/:testId` does not exist. Do not add a disabled button,
   do not link to a route you did not create.

9. **`passed: false`, `bestScore: null`, `attemptsCount: 0` are the truth, not
   placeholders** — no attempt can exist before slice 08. Display them
   («Не пройден», «—», «Попыток: 0») in both places a `LearningTestRef` appears:
   `finalTest` on the course, `requiredTest` on the lesson. Do not hide the
   block, do not special-case zero, do not compute anything from them.

10. **`start` fires once, by itself, and fails silently.** When a loaded lesson
    has `progressStatus === "not_started"` and the course is `published`,
    dispatch `startLesson(lessonId)` once for that lesson id. Guard it so it
    cannot fire twice for the same lesson or loop on failure; a failed `start`
    is bookkeeping, not a screen state, and the lesson still reads. `complete`
    is the opposite: an explicit «Завершить урок» click, disabled while the
    request is in flight (specification 5.3, 7.6). The click is the confirmed
    action — do not add a `Modal`.

11. **An archived course is read-only.** When `courseStatus === "archived"`,
    the course page renders a notice «Курс в архиве: доступен только для
    просмотра» and no «Продолжить обучение» button, the lesson page renders no
    completion button, and the card's control reads «Открыть» (specification
    7.4). The server refuses the action anyway; this is so the learner is not
    offered it.

12. **The card's button label comes from `lastActivityAt`.** `null` →
    «Начать», otherwise «Продолжить» — that field is exactly «has this learner
    touched the course». Both are a `Link` to `/learning/courses/:courseId`; the
    course page, not a lesson, is what they open (specification 7.4, 7.5).

13. **«Продолжить обучение» on the course page uses `nextLessonId`.** When it is
    `null` the button is not rendered and the learner stays on the course
    overview (specification 7.5). A `locked` row renders its title as plain
    text with the state label — no link, and no hidden row: seeing that a lesson
    exists and is closed is the point.

14. **One new primitive: `ProgressBar`,** in `client/src/components/ui/`,
    exported from `ui/index.ts`, props `{ value: number; label?: string }`,
    built on a native `<progress max={100}>` with a visible percentage beside
    it. Three screens use it. Everything else comes from the existing
    primitives — no second table, no one-off styled button.

15. **`/learning` reloads on every mount.** Its figures go stale as soon as a
    lesson is completed elsewhere in the section, and there is no cheaper honest
    way to keep them true.

## Files

New, under `client/src/features/learning/`:

- `learningApi.ts` — `requestLearningOverview()`,
  `requestLearningCourse(courseId)`,
  `requestLearningLesson(courseId, lessonId)`, `requestLessonStart(lessonId)`,
  `requestLessonComplete(lessonId)`. Same shape as `coursesApi.ts`.
- `learningSlice.ts` — **the cache of this slice; nothing else may hold it.**
  State `{ overview: { data: LearningOverview | null; status: LoadStatus; error:
  FormError | null }; course: { data: LearningCourse | null; status: LoadStatus;
  error: FormError | null }; lesson: { data: LearningLesson | null; status:
  LoadStatus; error: FormError | null } }`; thunks `fetchLearningOverview`,
  `fetchLearningCourse(courseId)`,
  `fetchLearningLesson({ courseId, lessonId })`, `startLesson(lessonId)` and
  `completeLesson(lessonId)`, each rejecting with `FormError`. Reuse the
  `LoadStatus` exported by `coursesSlice`. Decisions 3 and 4 live in this file.
  Do not write learning data into `coursesSlice`, `lessonsSlice` or
  `testsSlice`: those hold the teacher's catalogue and must not be overwritten
  by a learner's screen.
- `learningFormat.ts` — `LESSON_ACCESS_STATE_LABELS`,
  `LESSON_PROGRESS_STATUS_LABELS` and `formatMinutes(total: number): string`
  («2 ч 30 мин», «45 мин»). Dates come from the existing `formatDateTime`.
- `CourseCard.tsx`, `CourseCard.module.css` — props
  `{ card: LearningCourseCard }`. Cover or a placeholder block, title, short
  description, `ProgressBar`, «N из M уроков», the two status labels, the last
  activity, the control of decision 12.
- `LessonToc.tsx`, `LessonToc.module.css` — props `{ courseId: string; lessons:
  LearningLessonItem[]; currentLessonId?: string }`. The `Table` primitive:
  order, title (a `Link` unless `locked`), «Обязательный / Необязательный»,
  duration, state label, and a mark on the rows that have `hasTest`. The current
  lesson is marked, not linked. Used by both the course page and the lesson
  page.
- `TestSummaryCard.tsx`, `TestSummaryCard.module.css` — props `{ heading:
  string; test: LearningTestRef }`, the block of decisions 8 and 9.

New, under `client/src/pages/`:

- `LearningOverviewPage.tsx` + `.module.css` — `/learning`. The greeting from
  `state.auth.user`, the three figures of specification 7.4
  (`assignedCoursesCount`, `formatMinutes(totalLearningMinutes)`,
  `overallProgressPercent`), the cards, and all four states — including the
  `EmptyState` for a learner with no assignments, which specification 7.4 asks
  for by name.
- `LearningCoursePage.tsx` + `.module.css` — `/learning/courses/:courseId`.
  Cover, title, description, category, `COURSE_AUDIENCE_LABELS`, author,
  statuses, `ProgressBar`, «Продолжить обучение», `LessonToc`, `finalTest`
  through `TestSummaryCard`, a link back to `/learning`.
- `LearningLessonPage.tsx` + `.module.css` —
  `/learning/courses/:courseId/lessons/:lessonId`. Dispatches both the lesson
  and the course on mount (the course is the table of contents specification 7.6
  requires on this page). Title, order, duration, required flag, the material of
  decision 7, `requiredTest`, the course `ProgressBar`, the completion control
  of decision 10, the neighbour links from `previousLessonId` and
  `nextLessonId`, and — when an action answers `courseCompleted: true` — a
  «Курс пройден» notice with a link to the course page.

Edited, and only in the ways named:

- `client/src/App.tsx` — the three routes of decision 1.
- `client/src/store/index.ts` — register `learningReducer` as `learning`.
- `client/src/components/ui/index.ts` — export `ProgressBar`.

Nothing else.

## Not in this slice — do not add it

- Taking a test: `/learning/tests/:testId`, an attempt form, a result screen,
  anything reading or submitting answers — slice 08.
- `GET /learning/me/statistics`, a statistics block in `/profile`, charts,
  an activity feed — slices 09 and 12.
- `/admin` — slice 09. It stays a 404 and that is the expected intermediate
  state.
- A client-side rule about who may open what. `ProtectedRoute` and the server
  are the two checks that exist; a third one written in a page is a defect.
- New dependencies of any kind — no markdown renderer, no sanitiser, no date or
  chart library.
- New primitives beyond `ProgressBar`, a second API module, a second cache for
  learning data, a shared `ActionError` module extracted out of `LessonList`.
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

Write `.codex/reports/slice-07-client.md` in the format of `AGENTS.md` 8 and end
it with a numbered `## Проверить руками` checklist for the developer: each item
naming the URL, the input, and the result that means success. Start it from
`/learning` under `student@lms.local` / `Password1`.

What the seed leaves for that student: «Правила технической эксплуатации» —
lesson 1 required, lesson 2 optional **with a test attached**, lesson 3
required, lesson 4 a draft the learner must not see; and «Работа с
диспетчерской системой» — one required lesson and a **final test**, so that
course cannot reach «завершён» in this slice. Both are assigned.

The developer's database is not freshly seeded: as of the server review it
holds four assignments for that student, two of them in force on «Правила
технической эксплуатации» (an older `completed` one beside a new `active` one),
and lessons already completed in both courses. That is a fixture, not damage —
it is the only way to see a twice-assigned course showing up as one card. Say
in each item which state it needs, and mark the ones that want a course nobody
has started yet.

Cover at least: the empty state under `teacher2@lms.local` (no assignments), a
locked lesson opened by pasting its URL, the draft lesson being invisible, the
lesson with the test showing no completion button, and a completion that moves
the percentage and opens the next row without the page blanking.

Commit once, do not push, and stop.
