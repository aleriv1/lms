# Slice 09 (client half) — the administrator's dashboard and statistics

Read `AGENTS.md` first. It outranks this prompt. The specification outranks
both.

The server half of this slice is written, reviewed and accepted. You write the
client half only. **Do not touch anything under `server/` or `shared/`.**

## Goal

Four screens' worth of real figures (specification 7.10, 7.15, 7.16, 7.8):

1. `/admin` — the administrator's dashboard. **This route does not exist at
   all.** `routes/startPath.ts` sends an administrator to `/admin` after login
   and `components/layout/navItems.ts` has a menu item «Главная» pointing there,
   so today an administrator lands on `NotFoundPage` on every login. Closing
   that is the first job of this slice.
2. `/admin/statistics` — the summary and the table of learners.
3. `/admin/statistics/users/:userId` — the card of one learner.
4. The statistics block on the existing `/profile` (specification 7.8).

Every number on all four comes from the server and is displayed as it arrives.
You compute nothing. The one exception is named in decision 7.

## Before you start — read the server, then stop if it disagrees

This prompt was written from `server/src/routes/adminDashboard.ts`,
`adminStatistics.ts`, `learningStatistics.ts` and
`.claude/reports/slice-09-server-review.md`. Read the three route files and
confirm the paths, the queries and the refusals below. Do not start the dev
server and do not open a browser (`AGENTS.md` 9).

If a route is missing, differently named, or answers a different shape:
**stop, write what you found to `.codex/reports/slice-09-client.md`, and hand
back without writing client code.**

## Given

- `shared/` is written and compiled. **Do not modify it.** This slice needs
  `adminDashboardSchema`, `adminStatisticsQuerySchema`,
  `adminStatisticsResponseSchema`, `userStatisticsSchema`,
  `learnerStatisticsSchema` and the types `AdminDashboard`,
  `AdminStatisticsQuery`, `AdminStatisticsResponse`, `AdminStatisticsRow`,
  `CourseProgressStat`, `UserStatistics`, `LearnerStatistics`,
  `LearnerCourseStat`, `TestAttemptSummary`, plus `PAGE_SIZES`. Import them. If
  one looks wrong, stop and report — do not edit it.
- Slices 01–08 are accepted. `apiRequest`, `ApiError`, `toFormError`, the store,
  `ProtectedRoute`, the UI primitives (`Button`, `EmptyState`, `ErrorState`,
  `Loader`, `Pagination`, `ProgressBar`, `Select`, `Input`, `Table`),
  `formatDateTime` and `USER_STATUS_LABELS` (`features/users/userFormat.ts`),
  `ROLE_LABELS` (`components/layout/navItems.ts`). Reuse them, do not write
  second copies.
- **Read these four files before writing anything.** Your work is their shape
  with different fields: `client/src/pages/AdminUserListPage.tsx` (the house
  list idiom — query state in the URL, `Table`, `Pagination`, the four states),
  `client/src/features/users/adminUsersQueryParams.ts` (URL ↔ query object
  through the shared schema, with the schema defaults as the fallback for a
  hand-typed URL), `client/src/pages/AdminUserDetailPage.tsx` (the card idiom)
  and `client/src/pages/ProfilePage.tsx` (the page you extend).

## The API you are building against

All four require the session cookie. The three under `/admin` require the
administrator role — **a teacher is refused exactly as a learner is**
(specification 3.2).

| Method and path | Query | Answer |
|---|---|---|
| `GET /admin/dashboard` | — | `200` + `AdminDashboard` |
| `GET /admin/statistics` | `AdminStatisticsQuery` | `200` + `AdminStatisticsResponse` |
| `GET /admin/statistics/users/:userId` | — | `200` + `UserStatistics` |
| `GET /learning/me/statistics` | — | `200` + `LearnerStatistics` |

Refusals: `401` (handled globally, do not write a case for it), `403 forbidden`
on the three administrative routes for any other role, `404 not_found` for a
user id that is unknown **and** for one that cannot be an identifier at all,
`422 validation_error` for a `pageSize` outside `PAGE_SIZES`.

The two refusals are split by where the value came from, and the rule is the
project's, stated in `server/src/middleware/validate.ts`: a body or a query is
something the caller filled in, so it fails as `422` with the offending fields;
a path parameter is not a filled-in field, so a malformed id addresses nothing
and gets the same `404` a well-formed id for a missing user gets. **Do not stop
over this** — render both bad ids as the same not-found state (decision 11).
The `422` is reachable only by a hand-typed URL, and `readStatisticsQuery`
(decision 3) has to make it unreachable from the UI.

## Words that repeat with different meanings

**Two "user cards" that are not the same screen.** `/admin/users/:userId`
(slice 06) manages the account — role, status, assignments. `/admin/statistics/
users/:userId` (yours) shows the learning figures of the same person. Link each
to the other and do not merge them.

**`completedCoursesCount` means different things on two of your own screens.**
On the dashboard it counts finished **assignments** across the installation (a
course finished by ten people is ten), in a table row it counts that learner's
finished **courses**. The two disagree on purpose. Do not "fix" it, and do not
label both «Завершено курсов» without qualification: the dashboard card is
«Завершений курсов», the table column is «Завершено».

**`activeCoursesCount` on the dashboard vs in a row.** The dashboard's
`activeCoursesCount` is published courses in the installation; the row's is that
learner's assignments in force. Different entities entirely.

## Decisions already made — implement, do not reconsider

1. **`/admin` goes under the existing `roles={["admin"]}` route group** in
   `client/src/App.tsx`, as a sibling of `/admin/users`, with a new
   `AdminDashboardPage`. Add `/admin/statistics` and
   `/admin/statistics/users/:userId` there too. Do not touch `startPath.ts` or
   `navItems.ts` — they already point at `/admin` and are correct; the route was
   the missing half.

2. **A new slice `features/statistics/statisticsSlice.ts`**, registered in
   `client/src/store/index.ts` as `statistics`. Four independent branches —
   `dashboard`, `list`, `userCard`, `me`, plus `filterCourses` for the select of
   decision 4 — each with its own `LoadStatus` and error, exactly as
   `adminUsersSlice` keeps `list`, `detail` and `assignableCourses` apart. Five
   thunks in
   `features/statistics/statisticsApi.ts` over `apiRequest`, parsing each answer
   with its schema. Nothing here writes to the server: no mutations, no
   optimistic state.

3. **The statistics table keeps its query in the URL**, through a
   `features/statistics/statisticsQueryParams.ts` written after
   `adminUsersQueryParams.ts`: `readStatisticsQuery(params)` parsing with
   `adminStatisticsQuerySchema` and falling back to the schema defaults, and
   `toSearchParams(query)`. Keys: `page`, `pageSize`, `courseId`, `groupName`.
   **`learningStatus` is not among them** — see decision 4.

4. **Two filters of specification 7.15 are drawn, the third is not.** The server
   applies `courseId` and `groupName`; `learningStatus` is accepted by the
   contract and **ignored**, and stage 1 ends without it (specification 18.2).
   A control that changes nothing is worse than an absent control, so:
   - Draw a `Select` of courses (filter by course) and an `Input` for the group,
     debounced with the existing `useDebouncedValue` at `SEARCH_DEBOUNCE_MS`, as
     `AdminUserListPage` debounces its search.
   - **Draw no control for `learningStatus` and put its name nowhere on the
     screen.**
   - The course options come from the catalogue, through the existing
     `requestCourses` (`features/courses/coursesApi.ts`) — the same call
     `adminUsersSlice.assignableCourses` already makes, loaded once into its own
     branch of your slice. **Not** from `courseProgress` of the answer: that
     block shrinks to the selected course as soon as the filter is applied, and
     a select that loses its own options after one use is unusable. «Все курсы»
     is the first option and clears the filter.
   - Both filters reset `page` to 1 when they change.
   - A published course nobody is assigned to is a legitimate choice and gives
     an empty table. Decision 12 says how that reads.

5. **A row with no assignments shows «—» in the progress column, not «0 %».**
   This is a defect the review found and handed to you, not a preference. The
   table holds every account — administrators and teachers included — while the
   summary above it averages only over the people who actually have courses.
   Left alone, the page reads «Средний прогресс 100 %» above four rows of
   «0 %». Such a row is recognisable from the contract alone:
   `activeCoursesCount + completedCoursesCount === 0` means the person has no
   assignment at all. Show «—» in the progress column of exactly those rows.
   And label the summary figure so it says what it averages over — «Средний
   прогресс обучающихся» with a note «по пользователям, у которых есть
   назначения» — rather than a bare «Средний прогресс».

6. **The `Снято` row of a learner's course list is labelled so that its
   percentage is not read as the progress at the moment of revocation.** No such
   snapshot exists anywhere in the database — the number is the learner's
   current progress in that course. Wording is yours; «текущий прогресс» has to
   be visible in it. Revoked courses appear **only** on the administrator's card
   (7.16) and never in `/profile` (7.8): the server already sends different
   sets, do not filter either one again on the client.

7. **`testResults` is drawn by `isBest` / `isLast`, never by array order.** One
   test brings one row (when the last attempt is also the best) or two. Mark
   them «Последняя» and «Лучшая»; a row with both flags carries both marks and
   must not be drawn twice. Specification 7.16 fixes the columns: test, date,
   score, status, attempt number. The one number you may compute anywhere in
   this slice is nothing — even `passed` arrives from the server, so never
   compare `score` with a passing score yourself.

8. **`activityWeeks` and `recentActivity` always arrive as empty arrays** in
   stage 1 (`ActivityEvent` does not exist). Specification 7.8 asks for a chart
   of the last four weeks and requires a clear empty state when there is no
   data, so render the block's empty state — «Данных об активности пока нет» —
   and **no chart library, no placeholder bars, no fake data**. The same for
   «Последние учебные действия» on the administrator's card.

9. **The dashboard's «быстрые действия» (7.10) are three links** — create a
   course (`/manage/courses/new`), manage users (`/admin/users`), statistics
   (`/admin/statistics`). No new screens behind them.

10. **`recentCourses` is a short list on the dashboard, not a second catalogue.**
    Title, author, lesson count, status — and the status word comes from
    `COURSE_STATUS_LABELS` (`features/courses/courseLabels.ts`), which already
    exists; do not invent a second vocabulary for the same three statuses.
    The block carries courses of any status, drafts and archived included —
    that is deliberate («недавно созданные» is about the creation date — so do
    not filter it. Each title links to `/manage/courses/:courseId/edit`, the
    screen an administrator would open next.

11. **The card at `/admin/statistics/users/:userId` compares the id
    case-insensitively** (`toLowerCase()`) as `LearningLessonPage` does, and
    renders `404 not_found` as an `EmptyState` with a link back to
    `/admin/statistics`, not as a crash.

12. **Every screen renders the four states** — loading (`Loader`), error
    (`ErrorState` with a retry), empty (`EmptyState`) and loaded. The table's
    empty state must distinguish «нет пользователей» from «фильтр ничего не
    нашёл»: a course with no assignments legitimately gives an empty page.

## Out of scope — do not write it

- Anything under `server/` or `shared/`. If a figure looks wrong, report it; do
  not compute a replacement on the client.
- A `learningStatus` filter, an activity chart, an activity feed — stage 2, and
  stage 2 is not being done (specification 18.2).
- A chart library or any new dependency of any kind.
- Sorting controls for the statistics table: the server sorts by name and the
  query schema has no sort parameter.
- A client-side rule about who may see statistics. `ProtectedRoute` and the
  server are the two checks that exist; a third one in a page is a defect.
- Fixtures made by hand through the UI or the API (`AGENTS.md` 9).

If you need something beyond this list, stop and report instead of inventing it.

## Verification

The machine gate, once, at the end, from the repository root:

```
npm run typecheck && npm run lint && npm run build && npm run test
```

One line of result each in the report. Do not run `npm run seed`, do not start
`npm run dev`, do not open a browser (`AGENTS.md` 9).

## Hand over

Write `.codex/reports/slice-09-client.md` in the format of `AGENTS.md` 8 and end
it with a numbered `## Проверить руками` checklist for the developer: each item
naming the URL, the input, and the result that would mean success. Start it from
login as `admin@lms.local` / `Password1`, reaching every screen by the menu and
by links rather than by typed URLs — except in the items that are about typed
URLs.

Two things about the database the checklist has to say out loud, because the
developer will otherwise read them as defects in your work:

- **The developer's working database is not freshly seeded and holds one
  studying user.** Only `student@lms.local` has courses in force; the other five
  accounts are an administrator, two teachers, a blocked user and
  `student2@lms.local`, whose single assignment is revoked. So the summary shows
  «Средний прогресс 100 %» over five rows that show «—» — that is decision 5
  working, not a defect, and the checklist must say so in the item that looks at
  it.
- **Three things cannot be seen on this seed at all:** a course in progress
  (every progress is 0 or 100), a group holding more than one studying user, and
  a revoked assignment with progress above zero (so decision 6's wording cannot
  be checked against a non-zero number). All three wait for the full seed of
  slice 10. Write them into the checklist as items whose result is «не
  воспроизводится на текущем сиде», not as items to skip silently.

Cover at least: an administrator landing on `/admin` straight after login rather
than on a 404; every dashboard card against the figures of
`.claude/reports/slice-09-server-review.md` section 5; both filters, separately
and together, including a course nobody is assigned to; the «—» of decision 5;
the link from a table row to the learner's card and from there to
`/admin/users/:userId` and back; a teacher opening `/admin/statistics` by a
typed URL and being refused; the statistics block on `/profile` under
`student@lms.local` showing the same overall progress as `/learning`; and the
two empty states of decision 8.

Commit once, do not push, and stop.
