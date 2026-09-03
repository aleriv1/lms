# Slice 12, client half — the activity feed, the four-week chart, the status filter

Read `AGENTS.md` first. It outranks this prompt. The specification outranks
both.

The server half of slice 12 is done and merged: `ActivityEvent` exists, both
statistics endpoints now answer with real `recentActivity` and `activityWeeks`,
and `GET /api/admin/statistics` honours `learningStatus`. This half is the
screens for all three, plus the one frontend test specification 13 requires and
stage 1 never wrote.

**Check first that the server half is in.** `git log --oneline -5` should show
its commit, and `server/src/statistics/activityFeed.ts` should exist. If it does
not, stop and hand back — every screen here renders data that half produces.

## Goal

- The profile (`/profile`) draws the four-week activity chart of 7.8 instead of
  a permanent empty state.
- The learner card (`/admin/statistics/users/:userId`) draws the feed of recent
  learning actions of 7.16 instead of a permanent empty state.
- The statistics page (`/admin/statistics`) has the third filter of 7.15 —
  the learning status — alongside the course and the group.

No API client, no slice and no contract changes: the payloads already carry
these fields and `statisticsSlice` already stores them typed.

## Before you start — read these, then obey what they say

- `client/src/features/statistics/ProfileStatistics.tsx` — the block ending in
  «Активность за последние четыре недели», today `{activityWeeks.length === 0 && <EmptyState/>}`
  with no second branch.
- `client/src/pages/AdminStatisticsUserPage.tsx` — the same shape at
  «Последние учебные действия», by `recentActivity`.
- `client/src/pages/AdminStatisticsPage.tsx` — the filter row (`Select` for the
  course, `GroupFilter`, the reset button) and `hasFilter`.
- `client/src/features/statistics/statisticsQueryParams.ts` — `QUERY_KEYS`, the
  list that decides which filters survive a reload and a shared link.
- `client/src/features/statistics/StatisticsTables.tsx` and
  `Statistics.module.css` — how a block of this feature is put together.
- `client/src/features/users/userFormat.ts` — `formatDateTime`,
  `ASSIGNMENT_STATUS_LABELS`: the place labels and formatters live.
- `client/src/routes/ProtectedRoute.tsx` — four branches; the test below covers
  three of them.
- `shared/src/activity.ts`, `shared/src/statistics.ts` — the exact shapes.
  `activityWeeks` is **always four entries**, zero-filled; an empty array is not
  how "no data" arrives.

Stop and hand back only if something structural is missing. **Do not touch
`server/` or `shared/`.**

## Files

Write (new):

- `client/src/features/statistics/ActivityChart.tsx`
- `client/src/features/statistics/ActivityFeed.tsx`
- `client/src/routes/ProtectedRoute.test.tsx`

Change:

- `client/src/features/statistics/ProfileStatistics.tsx`
- `client/src/pages/AdminStatisticsUserPage.tsx`
- `client/src/pages/AdminStatisticsPage.tsx`
- `client/src/features/statistics/statisticsQueryParams.ts`
- `client/src/features/statistics/statisticsQueryParams.test.ts`
- `client/src/features/statistics/statisticsFormat.ts`
- `client/src/features/statistics/Statistics.module.css`

Do not add a dependency. There is no chart library in this project and this
slice does not introduce one: four bars are four `div`s.

## Decisions already made — implement, do not reconsider

### 1. Labels and formatting

In `statisticsFormat.ts`:

```ts
export const ACTIVITY_EVENT_LABELS: Record<ActivityEventType, string> = {
  lesson_started: "Начат урок",
  lesson_completed: "Завершен урок",
  test_submitted: "Отправлен тест",
  course_completed: "Завершен курс",
};

export function formatWeekStart(value: string): string;
```

`formatWeekStart` gives `дд.мм` — `new Date(value).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })`.
Labels carry no «ё», like every label already in the project.

### 2. The chart — `ActivityChart.tsx`

```tsx
export type ActivityChartProps = { weeks: ActivityWeek[] };
export function ActivityChart({ weeks }: ActivityChartProps);
```

- The empty state is decided by the data, not by the length: when every `count`
  is `0`, render `<EmptyState title="Данных об активности пока нет" />` and
  nothing else. That is 7.8's "when there is no data the chart is replaced by a
  clear empty state". **A zero-length array must not be the trigger** — the
  server always sends four weeks, so a length test would make the chart
  unreachable, which is exactly the defect this file exists to remove.
- Otherwise, one column per week in the order received (oldest first), each
  column: a bar whose inline `style={{ height: … }}` is
  `count === 0 ? 0 : Math.max(4, Math.round((count / max) * 100))` percent of
  the column, the count as text, and `formatWeekStart(week.weekStart)` under it.
  `max` is the largest count of the four. The floor of 4 % keeps a bar of one
  action visible next to a bar of forty.
- Accessible without reading the bars: the column exposes its numbers as text,
  and the chart is wrapped in a `<ul>`/`<li>` with an `aria-label` naming the
  four-week window. Colour carries no meaning here.

### 3. The feed — `ActivityFeed.tsx`

```tsx
export type ActivityFeedProps = { events: ActivityEvent[] };
export function ActivityFeed({ events }: ActivityFeedProps);
```

- `events.length === 0` → `<EmptyState title="Данных об активности пока нет" />`.
  Here the empty array **is** the right trigger: a learner with no actions has
  no rows.
- Otherwise an ordered list, newest first as received. One row is:
  `ACTIVITY_EVENT_LABELS[event.type]`, then `event.lessonTitle ?? event.courseTitle ?? "—"`
  as the subject, then `formatDateTime(event.createdAt)`. Both titles are
  nullable in the contract and a row must never render `null` or `undefined`.
- Do not link the titles anywhere. The identifiers are in the payload, but a
  course deleted since the event still has a title and a link to it would 404.

### 4. Wiring the two screens

- `ProfileStatistics.tsx` — replace the `{activityWeeks.length === 0 && …}`
  line with `<ActivityChart weeks={me.data.activityWeeks} />`. Leave the heading
  and the surrounding `<section>` as they are. `recentActivity` is in the
  learner payload but 7.8 does not list a feed among the contents of the
  profile: do not render one there.
- `AdminStatisticsUserPage.tsx` — replace the `{data.recentActivity.length === 0 && …}`
  line with `<ActivityFeed events={data.recentActivity} />`. Nothing else on
  that page changes.

### 5. The status filter

- `statisticsQueryParams.ts` — add `"learningStatus"` to `QUERY_KEYS`. That is
  the whole change: both functions iterate the list, and the shared schema
  already validates the value, so a hand-typed wrong one falls back with the
  rest.
- `AdminStatisticsPage.tsx`:
  - a third `Select`, label «Статус обучения», options
    `[{ value: "", label: "Любой статус" }, { value: "not_started", label: "Не начато" }, { value: "in_progress", label: "В процессе" }, { value: "completed", label: "Завершено" }]`,
    value `query.learningStatus ?? ""`, `onChange` →
    `updateQuery({ learningStatus: event.target.value || undefined })`. Build
    the options from `LEARNING_STATUSES` of `@lms/shared` against a label map so
    a fourth status cannot silently go missing from the control;
  - `hasFilter` becomes `Boolean(query.courseId || query.groupName || query.learningStatus)`;
  - the reset button clears all three.
  - The empty-state texts already branch on `hasFilter` and need no change.

### 6. Хвост среза 11 — the protected-route test

Specification 13 requires an automated test of "a complex form and a protected
frontend route". The form has one (`TestAttemptForm.test.tsx`); the route has
none, and that is the single line that kept slice 11 from being closed.
`AGENTS.md` (9) says rendering is not unit-tested here — specification 13
outranks it for this one file, and only for it.

`client/src/routes/ProtectedRoute.test.tsx`, in the style of
`TestAttemptForm.test.tsx` (`@testing-library/react`, `vitest`):

- build a store per case with `configureStore({ reducer: { auth: authReducer }, preloadedState: { auth: { user, status } } })`;
  `ProtectedRoute` reads nothing else from the state;
- render inside `<Provider>` and `<MemoryRouter initialEntries={["/admin"]}>`
  with routes for `/admin` (the protected `Outlet`), `/login` and `/forbidden`,
  so a redirect is observable as the other screen's content;
- three cases, one assertion each about what is on screen:
  1. `status: "anonymous"` → the login screen, not the protected content;
  2. `status: "authenticated"` with a `student` and `roles={["admin"]}` → the
     forbidden screen;
  3. `status: "authenticated"` with an `admin` and `roles={["admin"]}` → the
     protected content.

Build the `PublicUser` with `publicUserSchema.parse(…)` from `@lms/shared`, the
way `TestAttemptForm.test.tsx` builds its test with `learnerTestSchema.parse`.

### 7. `statisticsQueryParams.test.ts`

Two cases added to the existing file: `learningStatus` survives a round trip
through `toSearchParams`/`readStatisticsQuery`, and a value outside
`LEARNING_STATUSES` falls back to the schema defaults with the other filters.

## Verification

The gate of `AGENTS.md` (9), once, at the end, from the repository root:

```
npm run typecheck
npm run lint
npm run test
npm run build
```

Do not run `npm install`. Do not run the seed. Do not start `npm run dev`. Do
not open a browser — not to look at the chart, not to check a redirect. The
developer has the application running and will walk your checklist.

## The report

`.codex/reports/slice-12-client.md`, in the format of `AGENTS.md` (8), item 5
included: every claim about behaviour that already existed — the claim, the
check, what the check said. End with `## Проверить руками`: a numbered
checklist naming the URL, the account from the README table, the input and the
result that means success. Cover at least the chart with data, the chart for an
account with no activity, the feed on a learner card, each of the three values
of the status filter, the filter surviving a reload, and one protected route
reached without a session.

Then one commit, on the current branch, with the report in it. Do not push, do
not amend.
