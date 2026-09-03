# Slice 12, server half — activity events and the last filter of 7.15

Read `AGENTS.md` first. It outranks this prompt. The specification outranks
both.

This half introduces the one entity stage 1 left unbuilt — `ActivityEvent`
(specification 8.8) — writes it at the four moments 7.16 names, reads it back
into the two statistics endpoints that currently answer with empty arrays, and
implements `learningStatus`, the last of the three filters of 7.15. No screen
changes here: the client half is a separate session.

## Goal

After this half:

- every learning action of specification 7.16 leaves an `ActivityEvent`;
- `GET /api/learning/me/statistics` answers with four real week buckets and a
  real feed instead of `activityWeeks: []` and `recentActivity: []`;
- `GET /api/admin/statistics/users/:userId` answers with a real
  `recentActivity`;
- `GET /api/admin/statistics?learningStatus=…` narrows the table, the summary
  above it and the per-course averages to the learners in that state;
- `npm run seed --reset` produces events on the demo timeline, so the feed and
  the chart have something to show.

The contract needs no change: `shared/src/activity.ts`,
`shared/src/statistics.ts` and `shared/src/learning.ts` already carry
`activityEventSchema`, `activityWeekSchema`, `learningStatusSchema` and the two
response schemas. **Do not touch `shared/`.** If a field you need is missing
from a schema, stop and hand back — that is a contract question, not yours.

## Before you start — read these, then obey what they say

- `shared/src/activity.ts` — `activityEventSchema` (`id`, `type`, `courseId`,
  `courseTitle`, `lessonId`, `lessonTitle`, `createdAt`) and
  `activityWeekSchema` (`weekStart`, `count`). Note what is **not** there:
  `metadata` never leaves the server.
- `shared/src/enums.ts` — `ACTIVITY_EVENT_TYPES` and `activityEventTypeSchema`.
- `server/src/models/LessonProgress.ts` — the model style this project uses:
  explicit attribute type, `Schema`, indexes with a comment saying what each
  one serves.
- `server/src/routes/learning.ts` — the `start` and `complete` handlers
  (from line 360).
- `server/src/routes/learningTests.ts` — `loadLearnerTest` and the attempt
  handler.
- `server/src/learning/courseCompletion.ts` — `settleCourseCompletion`, the one
  place in the project that knows a course has just been finished.
- `server/src/routes/adminStatistics.ts` and
  `server/src/routes/learningStatistics.ts` — the two endpoints that fill in.
- `server/src/statistics/pairProgress.ts` — `loadPairProgress`,
  `groupPairsByUser`, `PairProgress`.
- `server/src/testing/apiClient.ts` — the test harness; it lists seven models
  twice and this slice makes it eight.

Stop and hand back **only** if something structural is missing — an export,
a model field or a route this prompt relies on does not exist. A different
message or a different comment is not a reason to stop.

## The rule that governs this half

**An event records an action that already succeeded.** Writing it must never
turn a successful request into a failed one: `recordActivity` catches its own
error, logs it and returns. Everything else in this half is an ordinary read.

## Files

Write (new):

- `server/src/models/ActivityEvent.ts`
- `server/src/learning/activityLog.ts`
- `server/src/statistics/activityFeed.ts`
- `server/src/statistics/activityFeed.test.ts`
- `server/src/routes/activity.test.ts`
- `server/src/routes/adminStatisticsFilter.test.ts`

Change:

- `server/src/routes/learning.ts`
- `server/src/routes/learningTests.ts`
- `server/src/learning/courseCompletion.ts`
- `server/src/routes/learningStatistics.ts`
- `server/src/routes/adminStatistics.ts`
- `server/src/statistics/pairProgress.ts`
- `server/src/testing/apiClient.ts`
- `server/src/scripts/seed.ts`
- `server/src/routes/auth.test.ts` — one assertion, see «Хвост среза 11» below.

Do not touch `client/`, `shared/`, any dependency or the lock file. Do not
create a migration script: the collection appears when the first event is
written.

## Decisions already made — implement, do not reconsider

### 1. The model

`server/src/models/ActivityEvent.ts`:

```ts
export type ActivityEventAttributes = {
  userId: Types.ObjectId;
  courseId: Types.ObjectId | null;
  lessonId: Types.ObjectId | null;
  type: ActivityEventType;
  metadata: { courseTitle: string | null; lessonTitle: string | null };
  createdAt: Date;
};
export type ActivityEventDocument = HydratedDocument<ActivityEventAttributes>;
export const ActivityEvent = model<ActivityEventAttributes>("ActivityEvent", activityEventSchema);
```

- `{ timestamps: false }`, and `createdAt: { type: Date, required: true, default: Date.now }`
  declared by hand. Reason: `timestamps` overwrites a supplied `createdAt`, and
  the seed writes events dated weeks back.
- `metadata` is a subdocument with `_id: false` and exactly those two string
  fields. Specification 8.8 requires "a limited set of safe fields" and forbids
  passwords, tokens and full answer keys; a typed subdocument with two title
  fields makes that unconditional rather than a habit. **Never widen it to
  `Mixed`.**
- The two titles are snapshots taken at the moment of the action, exactly as
  `TestAttempt.questionsSnapshot` is. The feed then needs no join and survives a
  deleted course — `loadCourseTitles` drops a course it cannot resolve, and a
  feed row vanishing because a course was deleted would be a defect.
- One index: `activityEventSchema.index({ userId: 1, createdAt: -1 })`. It
  serves both reads — the last N events of one learner, and the four-week
  aggregation.

### 2. Writing an event

`server/src/learning/activityLog.ts`:

```ts
export type ActivityTarget = { id: Types.ObjectId; title: string } | null;

export async function recordActivity(input: {
  userId: Types.ObjectId;
  type: ActivityEventType;
  course: ActivityTarget;
  lesson: ActivityTarget;
  createdAt?: Date;
}): Promise<void>;
```

It creates one document and **never rejects**: the body is wrapped in
`try`/`catch`, and the catch logs `console.error("activity event not recorded:", error)`
and returns. The reason is the rule above — the lesson is already completed by
the time this runs, and failing the response would tell the learner otherwise.
Do not add a retry, a queue or a transaction.

### 3. The four moments

Exactly four call sites. Each fires **once per real transition**, never on a
repeat.

1. **`lesson_started`** — `learning.ts`, the `POST /lessons/:lessonId/start`
   handler, inside the `if (status === "not_started")` branch and only when the
   `LessonProgress.create` actually created the row. The duplicate-key branch
   means a simultaneous request already recorded the start; it writes nothing.
   Take the course from `loadStudiableAssignedCourse` — the handler currently
   discards its result, change it to `const { course } = await …`.
2. **`lesson_completed`** — `learning.ts`, the `POST /lessons/:lessonId/complete`
   handler, inside `if (lessonState.progressStatus !== "completed")`, after
   `completeLesson` returns. A repeated completion writes nothing: 5.3 makes a
   repeated click harmless, and a feed that lists the same lesson four times is
   the visible form of not honouring that.
3. **`test_submitted`** — `learningTests.ts`, after `createAttempt` and before
   the branch on `graded.passed`. Every attempt, pass or fail: 7.16 names
   "submitting a test", not "passing one". `lesson` is `null` for a final test.
4. **`course_completed`** — `courseCompletion.ts`, inside
   `settleCourseCompletion`, in the `if (courseCompleted && assignment.status !== "completed")`
   branch after `assignment.save()`. That branch is the only place in the
   project that knows the transition happened rather than that the state holds.

To give site 4 a title, change the signature:

```ts
export async function settleCourseCompletion(
  userId: Types.ObjectId,
  course: { _id: Types.ObjectId; title: string },
  assignment: CourseAssignmentDocument,
  required: RequiredLessonCount,
): Promise<boolean>;
```

`learning.ts` already holds the course document and passes it unchanged. For
`learningTests.ts`, change `LearnerTestAccess.courseId: Types.ObjectId` to
`course: CourseDocument` (`loadLearnerTest` already has the document in both
return paths) and read `course._id` / `course.title` at the five places the
handler used `courseId`.

### 4. Reading events

`server/src/statistics/activityFeed.ts`:

```ts
export const RECENT_ACTIVITY_LIMIT = 10;
export const ACTIVITY_WEEK_COUNT = 4;

export function toActivityEvent(document: ActivityEventDocument): ActivityEvent;
export async function loadRecentActivity(userId: Types.ObjectId): Promise<ActivityEvent[]>;
export function startOfWeekUtc(date: Date): Date;
export function buildActivityWeeks(countByWeekStart: Map<string, number>, now: Date): ActivityWeek[];
export async function loadActivityWeeks(userId: Types.ObjectId, now?: Date): Promise<ActivityWeek[]>;
```

- `toActivityEvent` maps the document to the contract: `id` from `_id`,
  `courseId`/`lessonId` as strings or `null`, `courseTitle`/`lessonTitle` from
  `metadata`, `createdAt` as ISO. `metadata` itself never appears in the result.
- `loadRecentActivity` — `find({ userId }).sort({ createdAt: -1, _id: -1 }).limit(RECENT_ACTIVITY_LIMIT)`,
  newest first. The `_id` tiebreak is there for the same reason it is in
  `aggregateAssignmentPairs`: two events of one request share a millisecond.
- `startOfWeekUtc` — Monday 00:00:00.000 UTC of the week containing `date`.
  Weeks are UTC and start on Monday; the server has no notion of the viewer's
  timezone and inventing one would make the same event fall in two buckets on
  two screens.
- `loadActivityWeeks` — one aggregation, `$match { userId, createdAt: { $gte: windowStart } }`
  then `$group` on `{ $dateTrunc: { date: "$createdAt", unit: "week", startOfWeek: "monday", timezone: "UTC" } }`
  with `count: { $sum: 1 }`, where `windowStart` is `startOfWeekUtc(now)` minus
  three weeks. MongoDB 8 is what `docker-compose.yml` runs; `$dateTrunc` is
  available. Grouping in the database here does **not** contradict the rule in
  `pairProgress.ts` that rounding must stay in Node — that rule is about
  `$round` disagreeing with `Math.round` on a half, and counting events is exact
  integer arithmetic with no rounding in it.
- `buildActivityWeeks` always returns exactly `ACTIVITY_WEEK_COUNT` entries,
  oldest first, zero-filling the weeks with no events. A chart with a missing
  column would read as "no data that week" for a week that does exist. The
  empty state of 7.8 is then the client's job: every count zero, not an empty
  array.

Then:

- `learningStatistics.ts` — add `loadActivityWeeks(userId)` and
  `loadRecentActivity(userId)` to the existing `Promise.all` and drop the two
  literal `[]` with their now-false comment.
- `adminStatistics.ts`, the `/users/:userId` handler — add
  `loadRecentActivity(user._id)` to its `Promise.all` and drop the literal `[]`
  and its comment.

### 5. `learningStatus`

Add to `server/src/statistics/pairProgress.ts`:

```ts
export function learningStatusOf(pairs: PairProgress[]): LearningStatus;
```

In order, first match wins:

1. no pairs at all → `not_started` (an account nobody assigned anything to);
2. every pair has `assignmentStatus === "completed"` → `completed`;
3. every pair has `completed === 0` → `not_started`;
4. otherwise → `in_progress`.

With the `courseId` filter on, a learner has at most one pair and this reduces
to the reading the contract states — "the learner's state in the selected
course" (`shared/src/statistics.ts`). Without it, the same rules read over the
learner's whole set.

In the list handler of `adminStatistics.ts`, restructure so the pairs are read
**before** the page is chosen:

1. `const scope = await resolveScope(query)` as now;
2. `scopedUserIds` as now (only when `scope.filtered`);
3. `const allPairs = await loadPairProgress({ statuses: PAIR_STAGES, users: scopedUserIds, courseId: scope.courseId })`;
4. when `query.learningStatus` is set: take every user id of the scope
   (`scopedUserIds ?? (await User.distinct("_id", scope.filter))`), group
   `allPairs` with `groupPairsByUser`, keep the ids whose `learningStatusOf` is
   the requested status, and from there on use
   `filter = { ...scope.filter, _id: { $in: matchedIds } }`, `pairs =
   allPairs.filter(pair => matched.has(pair.userId))` and
   `countActiveUsers(matchedIds)`;
5. when it is not set, `filter`, `pairs` and the argument to `countActiveUsers`
   are exactly what they are today;
6. `User.countDocuments(filter)` and the paged `User.find(filter)` run on that
   filter, so `meta.total` and the pages describe the filtered set.

This keeps pagination in MongoDB. Note what it does **not** do: it computes no
progress that the handler was not already computing — the summary and the
per-course averages have always needed the pairs of the whole scope. The risk
zone of slice 09 forbids computing progress for everybody *in order to
paginate*; selecting inside a set already in memory is not that.

Update the two doc comments that promise this for a later slice — the one over
`resolveScope` and the one over the list handler.

### 6. The harness and the seed

- `server/src/testing/apiClient.ts` — add `ActivityEvent` to the model list in
  `connectTestDatabase` and to `clearDatabase`. Both lists become eight; the
  guard itself does not change.
- `server/src/scripts/seed.ts` — delete `ActivityEvent` in the `--reset` block
  (first, before the others) and update the message that says seven
  collections. Then write events **inside the branches that create the rows
  they describe**, so a second `npm run seed` on a seeded database adds nothing:
  - each created `LessonProgress` → `lesson_started` at its `startedAt`, plus
    `lesson_completed` at its `completedAt` when it is completed;
  - each created `TestAttempt` → `test_submitted` at its `submittedAt`;
  - each created assignment with a `completedAt` → `course_completed` at it.

  Titles come from the course and lesson the seed is already holding. Use
  `recordActivity` with its `createdAt` argument rather than a second way to
  write the collection.

## Tests

`server/src/statistics/activityFeed.test.ts` — pure, no database:

- `startOfWeekUtc` returns the same Monday for that Monday at 00:00 UTC, for
  the Sunday that ends the same week at 23:59 UTC, and for a Wednesday inside
  it;
- `buildActivityWeeks` returns four entries oldest first, puts a count in the
  right bucket, and reports `0` for the weeks with no events;
- an empty map gives four zeroes, not an empty array.

`server/src/routes/activity.test.ts` — over the real application, in the style
of `server/src/routes/learningAccess.test.ts`:

- a learner with one required published lesson and a final test: `start`,
  submit a passing attempt on the final test, `complete` the lesson — then
  `GET /api/learning/me/statistics` reports `recentActivity` newest first with
  the four types present, and `activityWeeks` with four entries whose counts sum
  to the number of events;
- a repeated `start` and a repeated `complete` add no second event of their
  type (count the documents);
- a failed attempt still records `test_submitted`;
- an administrator reading `GET /api/admin/statistics/users/:userId` sees the
  same feed, and the JSON of one event has no `metadata` key.

`server/src/routes/adminStatisticsFilter.test.ts` — three learners on one
course: one with no assignment, one assigned with no completed lesson, one
assigned with a completed required lesson, one whose assignment is `completed`.
For each of the three filter values, assert which rows come back, that
`meta.total` matches, and that `summary.usersCount` equals it.

### Хвост среза 11 — one assertion in `auth.test.ts`

The review of slice 11 found `registers a student and stores a hash without
exposing it` proves less than its name: `passwordHash` is only checked for
being non-empty and different from the password, which any random string would
satisfy. Add one assertion to that test — `verifyPassword` from
`server/src/auth/password.ts` returns `true` for the registered password and
the stored hash. Change nothing else in the file.

Assert what the handler answers. If a scenario shows a defect, do not fix it:
record the real behaviour in the test, put the scenario under «Расхождение с
ожиданием» in the report and hand back.

## Verification

The gate of `AGENTS.md` (9), once, at the end, from the repository root:

```
npm run db:up
npm run typecheck
npm run lint
npm run test
npm run build
```

Do not run `npm install`. Do not start `npm run dev`. Do not open a browser.
Run `npm run seed -- --reset` **only** if you changed the seed and want to see
it run — it rewrites the developer's demo database, so say in the report that
you ran it.

## The report

`.codex/reports/slice-12-server.md`, in the format of `AGENTS.md` (8), item 5
included: every claim this half makes about behaviour that already existed —
the claim, the check, what the check said. End with `## Проверить руками`: a
numbered checklist naming the URL, the input and the result that means success.
The developer has the application running and a seeded database.

Then one commit, on the current branch, with the report in it. Do not push, do
not amend, do not start the client half.
