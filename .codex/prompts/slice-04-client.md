# Slice 04 (client half) — lessons

Read `AGENTS.md` first. It outranks this prompt. The specification outranks both.

This slice is split between two executors. The server half is written and
reviewed separately; you write the client half only. **Do not touch anything
under `server/` or `shared/`.**

## Goal

Inside a course, its author builds a table of contents: adds lessons, edits
them, reorders them, publishes and unpublishes them. The lesson list lives on
the course edit page; creating and editing a lesson are their own screens
(specification 6, 7.12, 7.13).

Two things make this slice different from slice 03. The lesson body carries a
dynamic array — the resource links — and it carries an explicit order that the
server enforces as unique. Both are places where a form that "looks right" sends
a body the server rejects.

## Before you start — verify the server, then stop if it disagrees

The server half was written from `.claude/specs/slice-04-server.md`. This prompt
was written from the same spec. If the two disagree, the spec is right about
intent and the running server is right about fact — and you must not paper over
the difference.

With Docker up, the seeded teacher's cookie and one of their courses, confirm
the seven routes of the next section exist and answer with the shapes stated
there. If any route is missing, differently named, or returns a different shape:
**stop, write what you found to `.codex/reports/slice-04-client.md`, and hand
back without writing client code.** A prompt built on endpoints that do not
exist is a prompt defect, and reporting it costs an hour; discovering it after
the UI is written costs the slice.

## Given

- `shared/` is written, compiled and verified. **Do not modify anything under
  `shared/`.** Every schema this slice needs exists there: `lessonSchema`,
  `lessonSummarySchema`, `createLessonBodySchema`, `updateLessonBodySchema`,
  `reorderLessonsBodySchema`, `resourceLinkSchema`, `courseDetailSchema`,
  `lessonStatusSchema`, `LESSON_STATUSES`, `LESSON_ORDER_MIN`,
  `LESSON_ORDER_MAX`, `RESOURCE_LINKS_MAX_COUNT`. Import them. If one seems
  wrong, stop and report — do not edit it.
- Slices 01–03 are accepted. `apiRequest`, `ApiError`, `toFormError`,
  `FormError`, the store, `authSlice`, `coursesSlice`, `coursesApi`,
  `coursePermissions`, `courseLabels`, `ProtectedRoute`, `AppLayout`,
  `CourseForm`, `CourseEditPage` and the eleven UI primitives exist and are the
  surface you build on. Do not rewrite them.
- `npm run seed` gives you `admin@lms.local`, `teacher@lms.local`,
  `student@lms.local`, all with password `Password1`.
- MongoDB runs as a container: `npm run db:up`. The database is shared with the
  developer. Data you create by hand for verification is yours to remove
  afterwards.
- `Button` defaults to `type="button"`; it takes `variant`, `isLoading` and the
  native button attributes. `Input`, `Select`, `Textarea` and `Checkbox` take
  `label`, `error`, `isRequired` plus the native attributes, and forward the
  ref, so `{...form.register("field")}` works on all four. `Table` takes
  `caption`, `columns`, `rows`, `getRowKey`. `Modal` takes `isOpen`, `title`,
  `onClose`, `children`, `footer`.
- `CourseForm` and `CourseEditPage` are the two files to read before you write
  anything: `LessonForm` is `CourseForm`'s shape with a field array added, and
  `LessonEditPage` is `CourseEditPage`'s shape with different actions. Follow
  their conventions rather than inventing parallel ones.

## The API you are building against

All seven require the teacher or admin role, and authorship of the course.

| Call | Route | Answer |
|---|---|---|
| create | `POST /courses/:courseId/lessons` | `201` + `lessonSchema` |
| update | `PATCH /courses/:courseId/lessons/:lessonId` | `200` + `lessonSchema` |
| delete | `DELETE /courses/:courseId/lessons/:lessonId` | `204` |
| publish | `POST /courses/:courseId/lessons/:lessonId/publish` | `200` + `lessonSchema` |
| unpublish | `POST /courses/:courseId/lessons/:lessonId/unpublish` | `200` + `lessonSchema` |
| reorder | `POST /courses/:courseId/lessons/reorder` | `200` + `courseDetailSchema` |
| read one | `GET /lessons/:lessonId` | `200` + `lessonSchema` |

The asymmetry is deliberate and is not yours to fix: specification 6 fixes the
client route `/manage/lessons/:lessonId/edit`, which carries no course id, while
specification 9.2 fixes the mutation routes under the course. So reading one
lesson is flat, every mutation is course-scoped, and the course id for those
mutations comes from `lesson.courseId` on the loaded lesson.

There is no list route for lessons. The table of contents arrives inside
`courseDetailSchema.lessons`, from `GET /courses/:courseId`, which the course
edit page already fetches.

Error codes you must branch on: `forbidden`, `not_found`, `conflict` (an order
already taken, or publishing something already published), `validation_error`,
`unprocessable`. Display the server's `message`; do not compose your own text
for any of them.

## Decisions already made — implement, do not reconsider

**The table of contents lives in `coursesSlice`, not in a lessons slice.** It
arrives as part of `CourseDetail` and there must be exactly one copy of it in
the store. `coursesSlice` therefore grows `extraReducers` that respond to the
lesson thunks; `lessonsSlice` owns only the single lesson being edited. Do not
add a second list of lessons anywhere. `coursesSlice.ts` importing thunks from
`lessonsSlice.ts` is the intended direction and creates no cycle.

**Reordering is two buttons per row, not drag and drop.** A drag-and-drop
library is a dependency, and `AGENTS.md` 2 forbids adding one. «Вверх» and
«Вниз» also survive the keyboard-accessibility work of slice 13, which a custom
pointer implementation would not.

**Every reorder sends the whole list, renumbered `1..N`.** The server requires
the complete set of the course's lessons and repairs a failed write by replaying
the same request; a diff would defeat that. Renumbering also closes the gaps
left by deletions.

**PATCH sends the complete body**, every field the form owns, exactly as
`CourseEditPage.handleSave` already sends a full `CreateCourseBody` into
`updateCourse`. `updateLessonBodySchema` is `createLessonBodySchema.partial()`,
and in Zod `.partial()` does **not** remove the `.default()` inside a field:
parsing `{ title }` alone yields `{ title, resourceLinks: [], isRequired: true,
testId: null }`. The server defends against this by remembering which keys the
raw body actually had, but a client that sends partial bodies is relying on that
defence. Send everything.

**`videoUrl` must be present in a create body.** `optionalHttpUrlSchema` ends in
`.nullable()`, which accepts `null` but not `undefined`, so a create body
without the key fails validation with a message about `videoUrl` that will look
like nonsense. Give the field a `""` default in `defaultValues`, the same way
`CourseForm` does for `coverUrl`; the schema turns `""` into `null`.

**`testId` is always `null` in this slice.** Tests arrive in slice 05. Render no
test picker and send no other value: the server answers `404 not_found` for any
non-null id, because no test exists yet.

**Lesson content is a plain `Textarea` holding HTML.** No rich-text editor — it
is a dependency. And **no preview, nowhere**: the client has no sanitiser, the
server sanitises on write, and rendering lesson material to a reader belongs to
slice 07. Do not write `dangerouslySetInnerHTML` in this slice. If you find
yourself wanting it, that is the signal to stop and report.

**Order is a normal form field.** The create page prefills it with the smallest
free number, the author can change it, and a collision comes back from the
server as `409 conflict`. Do not hide the field and do not compute the value
again at submit time.

## Expected intermediate state — this is not a defect

- The lesson has a status but no test, no progress and no learner view. A
  published lesson is visible to nobody outside the management screens until
  slice 07.
- `CourseDetail.tests` stays an empty array. Do not render a tests section.
- Deleting a lesson is unconditional. The refusal to delete a lesson that has
  saved progress belongs to slice 07, where `LessonProgress` exists.
- The course page gains a table of contents but keeps everything it has today.
  Do not restructure `CourseEditPage`'s existing heading, actions, form or
  modal — add a section below the form.

## Not in this slice — do not add it

- Anything under `/learning`.
- Any test-related UI.
- Drag and drop, a rich-text editor, a Markdown renderer, a sanitiser, or any
  other new dependency.
- A lessons list route or a lessons catalogue page. Lessons are only ever seen
  through their course.
- Page-level component tests. The client's page tests are slice 14; the only
  tests here are the ones named in the Tests section.
- Changes to `CourseListPage`. It shows `lessonsCount`, which the server now
  fills — that needs no client change.

## Files

Create:

```
client/src/features/lessons/lessonsApi.ts
client/src/features/lessons/lessonsSlice.ts
client/src/features/lessons/lessonOrdering.ts
client/src/features/lessons/lessonOrdering.test.ts
client/src/features/lessons/lessonLabels.ts
client/src/features/lessons/LessonForm.tsx
client/src/features/lessons/LessonForm.module.css
client/src/features/lessons/LessonList.tsx
client/src/features/lessons/LessonList.module.css
client/src/pages/LessonCreatePage.tsx
client/src/pages/LessonEditPage.tsx
client/src/pages/LessonEditPage.module.css
```

Modify:

```
client/src/store/index.ts                        add the lessons reducer
client/src/App.tsx                               two routes behind the existing role guard
client/src/features/courses/coursesSlice.ts      extraReducers for the lesson thunks
client/src/pages/CourseEditPage.tsx              render LessonList below the form
client/src/pages/CourseEditPage.module.css       spacing for that section only
```

Anything else you find yourself editing means you have misread this prompt.
`client/src/components/ui/**` is finished; if a primitive does not fit, report
it instead of editing it.

## Feature module

**`client/src/features/lessons/lessonsApi.ts`** — thin `apiRequest` wrappers,
one per route, typed by the `shared/` schemas, with no logic.

```ts
export function requestLesson(lessonId: string): Promise<Lesson>;
export function requestLessonCreate(courseId: string, body: CreateLessonBody): Promise<Lesson>;
export function requestLessonUpdate(courseId: string, lessonId: string, body: UpdateLessonBody): Promise<Lesson>;
export function requestLessonDelete(courseId: string, lessonId: string): Promise<void>;
export function requestLessonPublish(courseId: string, lessonId: string): Promise<Lesson>;
export function requestLessonUnpublish(courseId: string, lessonId: string): Promise<Lesson>;
export function requestLessonsReorder(courseId: string, body: ReorderLessonsBody): Promise<CourseDetail>;
```

**`client/src/features/lessons/lessonOrdering.ts`** — pure functions, no React,
no store. This is the module the review reads first.

```ts
import type { LessonSummary, ReorderLessonsBody } from "@lms/shared";

/** Ascending by `order`; the server sends them sorted, this keeps them so after a local edit. */
export function sortLessons(lessons: LessonSummary[]): LessonSummary[];

/** Smallest number in [LESSON_ORDER_MIN, LESSON_ORDER_MAX] no lesson holds; LESSON_ORDER_MAX when all are taken. */
export function nextFreeOrder(lessons: LessonSummary[]): number;

/** The whole list renumbered 1..N with one lesson moved; null when the move is impossible. */
export function moveLesson(
  lessons: LessonSummary[],
  lessonId: string,
  direction: "up" | "down",
): ReorderLessonsBody | null;
```

`moveLesson` sorts, finds the index, returns `null` when the lesson is absent or
already at that end, swaps it with its neighbour, and renumbers the result
`1..N`. It never mutates its argument.

**`client/src/features/lessons/lessonLabels.ts`**

```ts
export const LESSON_STATUS_LABELS: Record<LessonStatus, string>;
```

Черновик / Опубликован. `Record<Enum, string>` is deliberate: a value added to
the enum then fails to compile instead of rendering a raw code.

**`client/src/features/lessons/lessonsSlice.ts`**

```ts
export type LessonsState = {
  detail: {
    lesson: Lesson | null;
    status: LoadStatus;
    error: FormError | null;
  };
};

export const fetchLesson: AsyncThunk;      // lessonId -> Lesson
export const createLesson: AsyncThunk;     // { courseId, body } -> Lesson
export const updateLesson: AsyncThunk;     // { courseId, lessonId, body } -> Lesson
export const deleteLesson: AsyncThunk;     // { courseId, lessonId } -> { courseId, lessonId }
export const publishLesson: AsyncThunk;    // { courseId, lessonId } -> Lesson
export const unpublishLesson: AsyncThunk;  // { courseId, lessonId } -> Lesson
export const reorderLessons: AsyncThunk;   // { courseId, body } -> CourseDetail
```

Import `LoadStatus` from `coursesSlice`; do not declare a second copy.

- Every thunk rejects with `rejectWithValue(toFormError(error))`, as in
  `authSlice` and `coursesSlice`. `ApiError` instances never enter the store.
- The slice's own reducers handle only `fetchLesson` (pending / fulfilled /
  rejected, the three of them exactly as `coursesSlice` handles `fetchCourse`)
  and `updateLesson.fulfilled`, which replaces `detail.lesson`. Everything else
  is consumed by `coursesSlice`.
- The slice stores no form errors: components read the rejected value, as in
  slices 02 and 03.

Register the reducer in `client/src/store/index.ts` under `lessons`.

**`client/src/features/courses/coursesSlice.ts`** — add `extraReducers` that
keep `detail.course` truthful, and nothing else. All five guard on
`state.detail.course?.id === courseId` before touching anything.

- `createLesson.fulfilled` — append `lessonSummarySchema.parse(action.payload)`,
  re-sort with `sortLessons`, increment `lessonsCount`.
- `updateLesson.fulfilled`, `publishLesson.fulfilled`,
  `unpublishLesson.fulfilled` — replace the matching summary the same way,
  re-sort.
- `deleteLesson.fulfilled` — drop the id, decrement `lessonsCount`.
- `reorderLessons.fulfilled` — replace `detail.course` with the payload whole.
  The server returns the course, so there is nothing to merge.

`lessonSummarySchema.parse(lesson)` is the projection from the full lesson to a
table-of-contents row, exactly as `replaceListCourse` already uses
`courseListItemSchema.parse(course)`. Do not hand-write the field mapping.

`lessonsCount` on `detail.course` counts lessons of every status, so it moves on
create and delete only — never on publish.

## Pages

**`LessonList`** (`client/src/features/lessons/LessonList.tsx`) — rendered by
`CourseEditPage` below the course form.

```ts
export type LessonListProps = { course: CourseDetail };
```

A `Table` over `sortLessons(course.lessons)` with columns: №, название,
длительность, обязательный, статус, действия. The lesson title links to
`/manage/lessons/:lessonId/edit`. Row actions:

- «Вверх» / «Вниз» — dispatch `reorderLessons` with `moveLesson(...)`; the
  button is disabled when `moveLesson` would return `null`, and every button in
  the table is disabled while a reorder is in flight;
- «Опубликовать» or «Снять с публикации», by current status;
- «Удалить», confirmed in a `Modal` that names the lesson.

Above the table, a «Добавить урок» link to
`/manage/courses/:courseId/lessons/new`. When `course.lessons` is empty, an
`EmptyState` with the same link instead of the table — the loading and error
states belong to the page that fetched the course, not here.

A failed action renders the server's message near the table. Reuse the
`ActionError` shape already in `CourseEditPage`; if you move it, move it into
`LessonList` and leave `CourseEditPage`'s own copy alone rather than building a
shared abstraction for two callers.

**`LessonForm`** (`client/src/features/lessons/LessonForm.tsx`) — the fields of
specification 7.13, with React Hook Form and `zodResolver(createLessonBodySchema)`.

```ts
export type LessonFormProps = {
  defaultValues?: Partial<CreateLessonBody>;
  submitLabel: string;
  onSubmit: (body: CreateLessonBody) => Promise<FormError | null>;
};
```

Fields, in order: название (`Input`), порядковый номер (`Input type="number"`,
`min`/`max` from `LESSON_ORDER_MIN`/`LESSON_ORDER_MAX`), длительность в минутах
(`Input type="number"`), содержание (`Textarea`, `rows={16}`), URL внешнего
видео (`Input type="url"`), ссылки на материалы (the field array below),
обязательный урок (`Checkbox`).

`defaultValues` must include `videoUrl: defaultValues?.videoUrl ?? ""`,
`resourceLinks: []`, `isRequired: true`, `testId: null`, and `order` and
`durationMinutes` as numbers — `order` has no sensible constant default, so the
pages pass it in.

Resource links use `useFieldArray` from React Hook Form:

- each row is a title `Input` and a url `Input` plus a «Удалить» button;
- «Добавить ссылку» appends `{ title: "", url: "" }` and is disabled at
  `RESOURCE_LINKS_MAX_COUNT`;
- field errors come from `form.formState.errors.resourceLinks?.[index]?.title`
  and `...?.url`, so a bad url is reported on its own row, not at the top;
- a server `fields` entry arrives as `resourceLinks.0.url` — pass the string to
  `form.setError` unchanged, it is already a valid React Hook Form path.

Otherwise the shape is `CourseForm`'s: a general error area, `setError` from
`FormError.fields`, and a submit button disabled while
`formState.isSubmitting`.

**`LessonCreatePage`** (`/manage/courses/:courseId/lessons/new`) — dispatches
`fetchCourse(courseId)` on mount, because it needs the course's title for the
heading and its lessons for the prefilled order. The four states are
`CourseEditPage`'s: `Loader`; `forbidden` → `<Navigate to="/forbidden" replace />`;
`not_found` → an `EmptyState` linking back to the catalogue; anything else an
`ErrorState` with a retry. On success, `LessonForm` with
`order: nextFreeOrder(course.lessons)`. Success navigates to
`/manage/lessons/:id/edit`, where publishing lives — the same move
`CourseCreatePage` makes.

**`LessonEditPage`** (`/manage/lessons/:lessonId/edit`) — dispatches
`fetchLesson(lessonId)` on mount, with the same four states over
`state.lessons.detail`. On success: a «Назад к курсу» link to
`/manage/courses/${lesson.courseId}/edit`, the current status through
`LESSON_STATUS_LABELS`, the actions, and the prefilled `LessonForm` keyed by
`lesson.id`.

Actions: «Опубликовать» or «Снять с публикации» by status, and «Удалить»
confirmed in a `Modal`. Deleting navigates back to the course. Saving shows
«Изменения сохранены» and stays on the page. **Saving and publishing are
different actions** — one button never does both.

The form's `onSubmit` dispatches `updateLesson` with `lesson.courseId` and the
full body.

**`client/src/App.tsx`** — two routes inside the existing
`ProtectedRoute roles={["teacher", "admin"]}` block:

```tsx
<Route
  path="/manage/courses/:courseId/lessons/new"
  element={<LessonCreatePage />}
/>
<Route path="/manage/lessons/:lessonId/edit" element={<LessonEditPage />} />
```

Do not restructure the existing route tree and do not move the catch-all.

## Tests

`client/src/features/lessons/lessonOrdering.test.ts`, with Vitest, no React:

- `sortLessons` orders ascending and does not mutate its argument;
- `nextFreeOrder` returns `1` for an empty list, fills a gap (`[1,3]` → `2`),
  and returns `LESSON_ORDER_MAX` when every number is taken;
- `moveLesson` up from the middle swaps with the previous lesson and renumbers
  `1..N`;
- `moveLesson` up from the first position, down from the last, and with an
  unknown id all return `null`;
- `moveLesson` closes gaps: orders `[2, 5, 9]` come back as `1..3`;
- the returned body satisfies `reorderLessonsBodySchema.safeParse`.

No other tests in this slice.

## Verification

From the repository root, and report the result of each:

```
npm install
npm run build
npm run typecheck
npm run lint
npm run test
```

Then, with Docker running:

```
npm run db:up
npm run seed
npm run dev
```

In the browser as `teacher@lms.local`, on a course you own, and report what each
returned:

1. The course edit page shows an empty table of contents with «Добавить урок».
2. Create a lesson: the order field is prefilled with `1`; save → you land on
   the lesson edit page; going back to the course shows the lesson as
   «Черновик».
3. Create a second lesson and force the order field to `1` → `409`, and the
   server's message is shown. Save it with order `2` instead.
4. On the second lesson, add two resource links, put `ftp://x` in one url →
   the error appears on that row, not at the top of the form. Fix it and save.
5. Reopen that lesson: both links are there, and «Обязательный урок» kept its
   value. This is the `.partial()` check — quote what the form showed.
6. Save a lesson leaving «URL внешнего видео» empty → `200`, not a validation
   error about `videoUrl`. This is the `.nullable()` check.
7. «Вниз» on the first lesson: the rows swap, and the numbers read `1, 2` — not
   `2, 1`. «Вверх» on the first lesson and «Вниз» on the last are disabled.
8. Publish the first lesson, then publish the course → the course publishes.
   Unpublish that lesson and publish the course again → `422`
   `course_not_publishable` naming lessons.
9. Delete a lesson from the course page: confirmation modal, the row goes, and
   the «уроки» count in `/manage/courses` follows.
10. Put `<script>alert(1)</script>` around some text in the content field, save,
    reopen → report exactly what came back. The server strips it; you are
    checking that the client neither strips nor executes anything.
11. As a second teacher (register through the UI, set `role` to `teacher`
    directly in MongoDB): opening `/manage/lessons/<id>/edit` for a foreign
    lesson lands on `/forbidden`, and `/manage/courses/<foreign id>/lessons/new`
    does too. Quote both.
12. As `admin@lms.local`: the same screens work on the teacher's course.
13. As `student@lms.local`: both new URLs land on `/forbidden`.

Then remove what you created: the second teacher's account and every course and
lesson made during verification. The database is shared with the developer. Then
stop every process you started — `AGENTS.md` 8. Leave the container running.

## Hand over

Write the self-report to `.codex/reports/slice-04-client.md` in the form of
`AGENTS.md` 8, make exactly one commit, and stop.

State explicitly in the report:

1. the result of the pre-flight check on the seven routes — matched, or what
   differed;
2. what the form showed at verification step 5, quoted;
3. what came back at verification step 10, quoted;
4. the two `/forbidden` results of step 11;
5. the state of the database when you finished: what you created and what you
   removed;
6. any file you touched that is not on the list above, and why;
7. anything you had to decide that this prompt left open — those are prompt
   defects and are wanted in the report even when your choice was obvious.
