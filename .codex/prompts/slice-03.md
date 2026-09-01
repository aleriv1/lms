# Slice 03 — courses: CRUD and lifecycle

Read `AGENTS.md` first. It outranks this prompt. The specification outranks both.

## Goal

A teacher creates a course, edits their own, publishes and archives it. A
catalogue with search, filters, sorting and server-side pagination. An
administrator edits anyone's course; a teacher does not — and not through the
API either, not only through a hidden button.

This is the first slice where authorisation depends on the *entity*, not on the
route. Route-level `requireRole("teacher", "admin")` lets two teachers into the
same endpoint; what keeps them apart is the authorship check inside the handler.
That check is the subject of the review.

## Given

- `shared/` is written, compiled and verified. **Do not modify anything under
  `shared/`.** Every schema this slice needs exists there: `coursesQuerySchema`,
  `courseSchema`, `courseListItemSchema`, `courseDetailSchema`,
  `createCourseBodySchema`, `updateCourseBodySchema`, `courseSortFieldSchema`,
  `COURSE_SORT_FIELDS`, `createListResponseSchema`, `listMetaSchema`,
  `objectIdSchema`, `courseStatusSchema`, `courseAudienceSchema`,
  `COURSE_STATUSES`, `COURSE_AUDIENCES`, `PAGE_SIZES`, `SEARCH_DEBOUNCE_MS`,
  `API_ERROR_CODES`. Import them. If one seems wrong, stop and report — do not
  edit it.
- Slices 01 and 02 are accepted. `AppError`, `validate`, `errorHandler`,
  `requireAuth`, `getAuthenticatedUser`, `requireRole`, `User`, `toPublicUser`,
  `apiRequest`, `ApiError`, `toFormError`, the store, `authSlice`,
  `ProtectedRoute`, `AppLayout` and the nine UI primitives exist and are the
  surface you build on. Do not rewrite them.
- `npm run seed` gives you `admin@lms.local`, `teacher@lms.local`,
  `student@lms.local`, all with password `Password1`.
- MongoDB runs as a container: `npm run db:up`. The database is shared with the
  developer. Data you create by hand for verification is yours to remove
  afterwards.
- `Button` defaults to `type="button"`. A submitting button states
  `type="submit"` itself.

## Decisions already made — implement, do not reconsider

- **`GET /api/courses` is open to `teacher` and `admin`, in every course status,
  including other people's drafts.** Specification 3.2 grants both roles the
  catalogue; only *editing* is restricted to the author and the administrator. A
  `student` gets `403 forbidden` — students reach courses through assignments
  (slice 07), never through the catalogue.
- **Everything under `/api/courses/:courseId` — the `GET` included — requires
  the author or an administrator.** Its only consumer is the edit screen, and
  specification 6 restricts that route to «Автор курса, администратор». Letting
  a foreign teacher load the form and fail on save would be the worse answer.
- **Search is a case-insensitive substring match**, over `title` and
  `shortDescription`, with the user's input escaped before it becomes a
  `RegExp`. Not a MongoDB text index: a text index matches whole words and would
  break a search that fires 500 ms after a keystroke. The `category` filter is
  the same kind of substring match — no category dictionary exists anywhere in
  the system. **Escaping is mandatory:** an unescaped `search=a(` reaches the
  driver as a broken pattern and answers `500`.
- **The filter and the sort are built by pure functions**, `buildCourseFilter`
  and `buildCourseSort`, separate from the route. That is what makes them
  testable without a database, and this slice's only automated tests are theirs.
- **Pagination is `skip`/`limit` plus a `countDocuments` of the same filter**,
  the two issued together through `Promise.all`. The collection is never read
  into memory to be counted or sliced in Node.
- **The sort always ends with `_id`** as a tiebreaker. Without it two courses
  sharing an `updatedAt` can swap places between page 1 and page 2, and one of
  them is never shown at all.
- **A course may be deleted only while it is `draft`.** Any other status →
  `409 course_delete_forbidden`. This is the whole of specification 4.2's rule,
  not a simplification of it: a course can only be assigned once it is published
  (slice 06), so a draft cannot carry assignments or progress, and a course that
  was ever published is refused.
- **New course routes rely on Express 5's native async error forwarding**: an
  `async` handler that throws `AppError` needs no `try`/`catch` and no
  `next(error)`. That is why Express 5 was chosen (`AGENTS.md` 4). The older
  style in `server/src/routes/auth.ts` and `users.ts` stays as it is — rewriting
  it is not part of this slice.
- **Every course response is parsed by its `shared/` schema before it is sent**,
  the way `usersRouter` parses `sessionResponseSchema`. It costs one line and it
  is what guarantees no extra field ever leaves the server.
- **The catalogue's state lives in the URL**, in `useSearchParams` — search,
  filters, sort, page and page size. The back button, a bookmark and the «Мои
  курсы» sidebar link then all work without extra code. The URL is user input:
  parse it with `safeParse` and fall back to the schema defaults, never let a
  hand-typed `?pageSize=7` throw inside a component.
- **The list thunk guards against stale responses by request id.** A debounced
  search fires overlapping requests, and the slower earlier one must not
  overwrite the newer result.
- React Hook Form with `zodResolver` over `createCourseBodySchema` /
  `updateCourseBodySchema` for the course form, as in slice 02. No hand-rolled
  validation.

## Expected intermediate state — this is not a defect

**No course can be published in this slice, and that is correct.**
Specification 4.2 requires at least one published required lesson before
publication, and lessons arrive in slice 04. So
`POST /courses/:courseId/publish` answers `422 course_not_publishable` for every
course, with `fields` naming `lessons`. Specification 7.12 asks the publication
error to explain which conditions are unmet — showing that explanation *is* this
slice's deliverable for publishing, and slice 04 turns the same button green.

Because of that:

- `publishRules.ts` holds the field conditions in full and the lesson condition
  as the single unconditional failure described below. It carries one comment
  saying the lesson query lands with the `Lesson` model in slice 04. That
  comment is authorised by this prompt; do not add any other `TODO`.
- The `published` and `archived` branches of the catalogue, of `DELETE` and of
  `archive` are reached during verification by setting `status` directly in
  MongoDB. The steps are given below.
- `courseDetailSchema.lessons` and `.tests` are `[]`, and `lessonsCount` is `0`,
  in every response. The mappers take `lessonsCount` as an explicit argument and
  the routes pass `0`, so slice 04 changes the routes and not the mapper. Do not
  denormalise a counter onto the course document.
- The edit screen shows no lesson list and no test list. Slices 04 and 05 add
  them.

## Not in this slice — do not add it

- **Lessons and tests** in any form: no model, no routes, no UI, no deletion
  cascade. A draft course has neither.
- **The author picker for the administrator** (specification 7.11). It needs the
  user list, which arrives in slice 06. The API accepts any `authorId`; what is
  deferred is the control, not the capability. Both roles get the «Только мои
  курсы» checkbox, which is what specification 5.1 means by implementing «Мои
  курсы» as a filter of the catalogue.
- **An unarchive route.** Specification 9.2 lists none. `publish` is the way back
  from `archived`, and it obeys the same conditions as any publication.
- **The unsaved-changes warning** of specification 5.3 — it needs
  `createBrowserRouter` and `useBlocker`, and that migration happens once, for
  all forms at once, in a later slice. Keep `<BrowserRouter>`. Do not build a
  substitute with `beforeunload`.
- **Assignments, progress, statistics, counters on the catalogue.** Slices 06,
  07 and 09.
- **Seed data for courses.** The demo dataset is slice 10. Create courses
  through the UI.
- **Route-level tests that need a database.** How tests get a database is
  decided in slice 11. Write only the test file listed below; do not add
  `mongodb-memory-server` or `supertest`.

## Dependencies

**None.** Not one new package in any workspace.

Specifically: no `lodash.debounce` — the debounce is a `useEffect` with a
`setTimeout` and a cleanup; no query-string library — `URLSearchParams` is in
the platform; no RTK Query — `AGENTS.md` 6 rules out a second data layer; no
date library. If you believe a package is unavoidable, stop and report it
(`AGENTS.md` 2).

## Files

Create:

```
server/src/models/Course.ts
server/src/courses/courseQuery.ts
server/src/courses/courseQuery.test.ts
server/src/courses/courseAccess.ts
server/src/courses/publishRules.ts
server/src/routes/courses.ts

client/src/hooks/useDebouncedValue.ts
client/src/components/ui/Table/Table.tsx
client/src/components/ui/Table/Table.module.css
client/src/components/ui/Pagination/Pagination.tsx
client/src/components/ui/Pagination/Pagination.module.css
client/src/features/courses/coursesApi.ts
client/src/features/courses/coursesSlice.ts
client/src/features/courses/coursesQueryParams.ts
client/src/features/courses/courseLabels.ts
client/src/features/courses/coursePermissions.ts
client/src/features/courses/CourseForm.tsx
client/src/features/courses/CourseForm.module.css
client/src/pages/CourseListPage.tsx
client/src/pages/CourseListPage.module.css
client/src/pages/CourseCreatePage.tsx
client/src/pages/CourseEditPage.tsx
client/src/pages/CourseEditPage.module.css
```

`client/src/hooks/` is a new folder, created deliberately: slice 06 reuses the
same debounce for the user search.

Modify:

```
server/src/routes/index.ts                  mount coursesRouter
client/src/components/ui/index.ts           export Table and Pagination
client/src/store/index.ts                   add the courses reducer
client/src/App.tsx                          three routes behind a role guard
client/src/components/layout/navItems.ts    getNavItems(user), «Мои курсы»
client/src/components/layout/AppLayout.tsx  new signature and active rule
```

Anything else you find yourself editing means you have misread this prompt.
`client/src/components/ui/**` beyond the two new primitives is finished; if a
primitive does not fit, report it instead of editing it.

## Server — model

**`server/src/models/Course.ts`**

```ts
import type { Course, CourseAudience, CourseListItem, CourseStatus } from "@lms/shared";
import { type HydratedDocument, model, Schema, type Types } from "mongoose";

export type CourseAttributes = {
  title: string;
  category: string;
  audience: CourseAudience;
  shortDescription: string;
  description: string;
  coverUrl: string | null;
  authorId: Types.ObjectId;
  status: CourseStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CourseDocument = HydratedDocument<CourseAttributes>;

/** A course whose author was populated with the two fields `userRefSchema` needs. */
export type CourseWithAuthor = Omit<CourseAttributes, "authorId"> & {
  _id: Types.ObjectId;
  authorId: { _id: Types.ObjectId; name: string };
};

export const COURSE_AUTHOR_FIELDS = "name";

export const Course = model<CourseAttributes>("Course", courseSchema);

export function toCourse(course: CourseWithAuthor, lessonsCount: number): Course;
export function toCourseListItem(course: CourseWithAuthor, lessonsCount: number): CourseListItem;
```

Schema: `title`, `category`, `shortDescription` required and `trim`;
`description` defaults to `""`; `coverUrl` defaults to `null`; `audience`
required with the `COURSE_AUDIENCES` enum; `authorId` a required
`Schema.Types.ObjectId` with `ref: "User"`; `status` with the `COURSE_STATUSES`
enum, default `"draft"`; `publishedAt` default `null`; `timestamps: true`.

Indexes, declared on the schema:

```
{ authorId: 1, updatedAt: -1 }
{ status: 1, updatedAt: -1 }
{ category: 1 }
```

They serve the filters and the default sort. The substring search is not
indexed — at the scale of this system that is the right trade, and being able to
say so is part of the defence.

The mappers produce exactly the fields of `courseSchema` and
`courseListItemSchema`: `_id` and the author id as strings, dates as ISO
strings, `publishedAt` as `null` or an ISO string. Routes load courses with
`.populate<{ authorId: { _id: Types.ObjectId; name: string } }>("authorId", COURSE_AUTHOR_FIELDS)`.
If that generic does not type-check against the installed Mongoose, **report it
— do not reach for `any` or a non-null assertion** (`AGENTS.md` 7).

## Server — query helpers

**`server/src/courses/courseQuery.ts`** — pure. No model imports, no database
access, no knowledge of the current user.

```ts
import type { CoursesQuery } from "@lms/shared";
import type { FilterQuery, SortOrder } from "mongoose";
import type { CourseAttributes } from "../models/Course.js";

/** Escapes every RegExp metacharacter, so user input is matched literally. */
export function escapeRegExp(value: string): string;

/** Builds the MongoDB filter for `GET /courses` from the validated query. */
export function buildCourseFilter(query: CoursesQuery): FilterQuery<CourseAttributes>;

/** Sort by the requested field, with `_id` as a stable tiebreaker. */
export function buildCourseSort(query: CoursesQuery): Record<string, SortOrder>;
```

`buildCourseFilter` adds a key only for a parameter that is present:

- `search` → `$or` of case-insensitive substring regexes on `title` and
  `shortDescription`;
- `category` → a case-insensitive substring regex on `category`;
- `audience`, `status` → equality;
- `authorId` → equality on `authorId`.

A query carrying only defaults produces `{}`. Whose courses are visible is a
routing decision, and in this slice the catalogue shows everyone's.

`buildCourseSort` maps `sortOrder` to `1` / `-1` and returns
`{ [query.sortBy]: order, _id: order }`.

## Server — access and publication

**`server/src/courses/courseAccess.ts`**

```ts
import type { PublicUser } from "@lms/shared";

/**
 * Loads a course for an operation on that specific course and enforces
 * specification 3.2: the author or an administrator, nobody else.
 * Throws 404 `not_found` when it does not exist, 403 `forbidden` when the
 * caller is a teacher who does not own it.
 */
export async function loadOwnedCourse(courseId: string, user: PublicUser): Promise<...>;
```

Choose the return type your populate call actually produces and keep it honest:
the routes need both the document, to save it, and the populated author, to map
it. Order matters — existence first, then ownership.

This function is the reason the slice exists. Every route below calls it, and no
route re-implements its checks.

**`server/src/courses/publishRules.ts`**

```ts
import type { FieldError } from "@lms/shared";
import type { CourseAttributes } from "../models/Course.js";

/** Specification 4.2: what a course must have before it can be published. */
export function collectPublicationIssues(
  course: Pick<CourseAttributes, "title" | "category" | "audience" | "shortDescription">,
): FieldError[];
```

It returns one `FieldError` per unmet condition — an empty `title`, `category`
or `shortDescription`, a missing `audience` — plus, unconditionally in this
slice, `{ field: "lessons", message: "Добавьте хотя бы один опубликованный обязательный урок" }`.
The field checks are not dead code: they are the conditions specification 4.2
names, and they keep answering after slice 04 replaces the lesson line with a
real query.

The route turns a non-empty result into `new AppError(422,
"course_not_publishable", "Курс нельзя опубликовать: не выполнены условия",
issues)`.

## Server — routes

Mount in `server/src/routes/index.ts`: `apiRouter.use("/courses", coursesRouter)`.

Every route in `server/src/routes/courses.ts` sits behind `requireAuth` and
`requireRole("teacher", "admin")` — declared once on the router, not repeated
per route. Every mutating route validates its body in middleware with
`validate(schema)` before the handler (`AGENTS.md` 5).

Path parameters are validated with a locally composed schema, used as a **guard
only**:

```ts
const courseParamsSchema = z.object({ courseId: objectIdSchema });
```

Composing `objectIdSchema` from `shared/` is not redeclaring a contract. Read
`request.params.courseId` directly in the handler and do not depend on
`validate` having replaced `request.params`: Express restores the params object
for each layer. Without this guard a hand-typed `/api/courses/abc` reaches
`findById`, throws a Mongoose `CastError` and answers `500`.

**`GET /api/courses`** — `validate(coursesQuerySchema, "query")`, then

```ts
const query = request.query as unknown as CoursesQuery;
```

`Promise.all` of the paginated `find` and the `countDocuments` over the same
filter; `skip((page - 1) * pageSize)`, `limit(pageSize)`, the sort from
`buildCourseSort`, the author populated. Responds `200` with
`createListResponseSchema(courseListItemSchema).parse({ items, meta })`, where
`meta` is `{ page, pageSize, total, totalPages: Math.ceil(total / pageSize) }`
and `totalPages` is `0` when `total` is `0`.

This is the first use of `validate(..., "query")` in the project. Confirm at
runtime that the coerced defaults reach the handler: a bare `GET /api/courses`
must answer with `meta.page === 1` and `meta.pageSize === 10`. **If Express 5
hands the handler the raw query instead, stop and report it** — do not paper
over it by re-parsing inside the handler.

**`POST /api/courses`** — `validate(createCourseBodySchema)`. Creates the course
with `authorId` = the caller, `status: "draft"`, `publishedAt: null`. The body
carries no status and the handler must not read one from it. Responds **`201`**
with `courseSchema.parse(toCourse(...))`.

**`GET /api/courses/:courseId`** — `loadOwnedCourse`. Responds `200` with
`courseDetailSchema.parse({ ...toCourse(course, 0), lessons: [], tests: [] })`.

**`PATCH /api/courses/:courseId`** — `validate(updateCourseBodySchema)`,
`loadOwnedCourse`. Assigns only the fields present in the body, saves, responds
`200` with `courseSchema`. Allowed in any status: editing a published course is
explicitly permitted by specification 4.2, and nothing here touches progress.
`authorId`, `status` and `publishedAt` are not editable through this route.

**`DELETE /api/courses/:courseId`** — `loadOwnedCourse`. A status other than
`draft` → `409 course_delete_forbidden`, message «Опубликованный курс нельзя
удалить — его можно архивировать». Otherwise delete the document and respond
`204`.

**`POST /api/courses/:courseId/publish`** — `loadOwnedCourse`. Already
`published` → `409 conflict`, «Курс уже опубликован». Otherwise
`collectPublicationIssues`; a non-empty result → the `422` above. Otherwise set
`status: "published"`, set `publishedAt` if it is still `null`, save, respond
`200` with `courseSchema`. `draft` and `archived` are both valid starting
points: with no unarchive route, publishing is the way back, and it is not a
loophole because the publication conditions still apply.

**`POST /api/courses/:courseId/archive`** — `loadOwnedCourse`. Already
`archived` → `409 conflict`, «Курс уже в архиве». Otherwise set
`status: "archived"`, **keep `publishedAt`**, save, respond `200` with
`courseSchema`. Archiving never deletes anything.

## Client — primitives

**`client/src/components/ui/Table/Table.tsx`**

```ts
import type { ReactNode } from "react";

export type TableColumn<TRow> = {
  key: string;
  header: string;
  render: (row: TRow) => ReactNode;
};

export type TableProps<TRow> = {
  caption: string;
  columns: TableColumn<TRow>[];
  rows: TRow[];
  getRowKey: (row: TRow) => string;
};
```

A plain `<table>` with a `<caption>` hidden visually but present for screen
readers, `<th scope="col">` in the head, and a horizontal scroll container so a
narrow window does not break the layout. The table renders rows and nothing
else: loading, empty and error are the page's four states, not the table's.

**`client/src/components/ui/Pagination/Pagination.tsx`**

```ts
export type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};
```

Returns `null` when `total <= pageSize` — specification 5.4 hides pagination
when everything fits on one page. Otherwise: «Назад» and «Вперёд» disabled at
the ends, the text «Страница N из M», the total, and a page-size `Select` built
from `PAGE_SIZES`. It computes no page of its own beyond calling back with
`page - 1` or `page + 1`.

Both are exported from `client/src/components/ui/index.ts` in the existing
alphabetical order. CSS Modules over `client/src/styles/tokens.css`; no new
colour literals.

## Client — feature module

**`client/src/hooks/useDebouncedValue.ts`**

```ts
export function useDebouncedValue<TValue>(value: TValue, delayMs: number): TValue;
```

`useState` + `useEffect` + `setTimeout`, cleared on every change and on unmount.
Nothing else: no leading edge, no cancel handle, no options object.

**`client/src/features/courses/coursesQueryParams.ts`** — the URL is the single
source of truth for the catalogue, and this module is the only place that knows
its shape.

```ts
import type { CoursesQuery } from "@lms/shared";

/** Parses the URL. Invalid or hand-typed values fall back to the schema defaults. */
export function readCoursesQuery(params: URLSearchParams): CoursesQuery;

/** Serialises a query for the URL and for the API, omitting empty values. */
export function toSearchParams(query: CoursesQuery): URLSearchParams;
```

`readCoursesQuery` builds a plain object from the parameters that are present
and runs `coursesQuerySchema.safeParse`; on failure it returns
`coursesQuerySchema.parse({})`. It never throws.

**`client/src/features/courses/coursesApi.ts`** — thin `apiRequest` wrappers,
one per route, typed by the `shared/` schemas, with no logic beyond building the
query string through `toSearchParams`.

```ts
export function requestCourses(query: CoursesQuery): Promise<ListResponse<CourseListItem>>;
export function requestCourse(courseId: string): Promise<CourseDetail>;
export function requestCourseCreate(body: CreateCourseBody): Promise<Course>;
export function requestCourseUpdate(courseId: string, body: UpdateCourseBody): Promise<Course>;
export function requestCourseDelete(courseId: string): Promise<void>;
export function requestCoursePublish(courseId: string): Promise<Course>;
export function requestCourseArchive(courseId: string): Promise<Course>;
```

**`client/src/features/courses/coursesSlice.ts`**

```ts
export type LoadStatus = "idle" | "loading" | "ready" | "error";

export type CoursesState = {
  list: {
    items: CourseListItem[];
    meta: ListMeta;
    status: LoadStatus;
    requestId: string | null;
  };
  detail: {
    course: CourseDetail | null;
    status: LoadStatus;
    error: FormError | null;
  };
};

export const fetchCourses: AsyncThunk;   // CoursesQuery
export const fetchCourse: AsyncThunk;    // courseId
export const createCourse: AsyncThunk;   // CreateCourseBody -> Course
export const updateCourse: AsyncThunk;   // { courseId, body } -> Course
export const deleteCourse: AsyncThunk;   // courseId -> courseId
export const publishCourse: AsyncThunk;  // courseId -> Course
export const archiveCourse: AsyncThunk;  // courseId -> Course
```

- Every thunk rejects with `rejectWithValue(toFormError(error))`, as in
  `authSlice`. `ApiError` instances never enter the store.
- `fetchCourses.pending` stores `action.meta.requestId`; `fulfilled` and
  `rejected` **apply only while that id still matches** the one in state.
  Overlapping debounced searches are the normal case on this screen, and the
  older answer must lose.
- `fetchCourse.rejected` keeps the `FormError` in `detail.error`: the edit page
  branches on `code`, and `forbidden` and `not_found` are different screens.
- `publishCourse` and `archiveCourse` fulfil with the updated course: replace
  that item in `list.items` and, when it is loaded, `detail.course`.
  `deleteCourse` is the one action the page follows with a refetch, so the page
  is refilled from the server instead of silently shrinking.
- The slice stores no form errors for the create and edit forms: components read
  the rejected value, exactly as in slice 02.

Register the reducer in `client/src/store/index.ts` under `courses`.

**`client/src/features/courses/courseLabels.ts`**

```ts
export const COURSE_STATUS_LABELS: Record<CourseStatus, string>;
export const COURSE_AUDIENCE_LABELS: Record<CourseAudience, string>;
```

Черновик / Опубликован / В архиве; Водители / Технический персонал /
Диспетчеры / Руководство / Общий. `Record<Enum, string>` is deliberate: a value
added to the enum then fails to compile instead of rendering a raw code.

**`client/src/features/courses/coursePermissions.ts`**

```ts
export function canEditCourse(user: PublicUser | null, course: { author: { id: string } }): boolean;
```

`admin`, or the author. It hides controls and nothing more. The server decides
(`AGENTS.md` 5), and the review tests the API directly.

## Client — pages and routes

**`CourseListPage`** (`/manage/courses`) — specification 7.11.

Reads the query with `useSearchParams` + `readCoursesQuery` and dispatches
`fetchCourses` whenever it changes. Controls, all writing back into the URL:

- search `Input`, its value held in local state and pushed to the URL through
  `useDebouncedValue(value, SEARCH_DEBOUNCE_MS)`;
- category `Input`, debounced the same way;
- audience `Select` — «Все аудитории» plus `COURSE_AUDIENCE_LABELS`;
- status `Select` — «Все статусы» plus `COURSE_STATUS_LABELS`;
- «Только мои курсы» `Checkbox` — sets or clears `authorId` = the current user;
- sort `Select` over `COURSE_SORT_FIELDS` with Russian labels, plus an order
  toggle;
- «Создать курс» link to `/manage/courses/new`.

**Every change except the page number resets `page` to `1`** (specification
5.4). A filter change that leaves the page at 4 shows an empty table over a
catalogue that has results, and that is the classic defect of this screen.

Four states (`AGENTS.md` 6): `Loader` while loading; `ErrorState` with a retry
that redispatches; `EmptyState` with «Создать курс» when the result is empty and
no filter is set, and a different `EmptyState` inviting the user to relax the
filters when one is; otherwise the `Table` plus `Pagination`.

Columns: название, категория, аудитория, уроки (`lessonsCount`), статус, автор,
действия. Row actions, rendered only when `canEditCourse`: «Редактировать» (a
link to the edit page), «Опубликовать», «Архивировать», «Удалить» — the last
only for a `draft`. Deletion and archiving are confirmed in a `Modal`
(specification 5.3): the modal names the course, its confirm button shows the
in-flight state, and it closes on success. A failed action shows the server's
message — do not compose your own text for `course_delete_forbidden` or
`course_not_publishable`.

**`CourseCreatePage`** (`/manage/courses/new`) and **`CourseEditPage`**
(`/manage/courses/:courseId/edit`) share **`CourseForm`**, which owns the fields
of specification 7.12 — название, категория, аудитория, краткое описание,
полное описание, URL обложки — with React Hook Form, `zodResolver`, labels
through the existing primitives, a general error area, field errors applied from
`FormError.fields` with `setError`, and a submit button disabled while
`formState.isSubmitting`.

```ts
export type CourseFormProps = {
  defaultValues?: Partial<CreateCourseBody>;
  submitLabel: string;
  onSubmit: (body: CreateCourseBody) => Promise<FormError | null>;
};
```

The pages own navigation and confirmation; the form owns fields and errors.

- Create: on success navigate to `/manage/courses/:id/edit` — the natural next
  step is publishing the course, and that action lives on the edit screen.
- Edit: dispatch `fetchCourse` on mount. `Loader` while loading; on
  `detail.error.code === "forbidden"` render
  `<Navigate to="/forbidden" replace />` (specification 3.1 — the route belongs
  to the author and the administrator); on `not_found` an `EmptyState` with a
  link back to the catalogue; on anything else an `ErrorState` with a retry. On
  success: the prefilled form, the current status, and the «Опубликовать» /
  «Архивировать» / «Удалить» actions with the same modal confirmations as the
  list. Saving shows «Изменения сохранены» and stays on the page. **Saving and
  publishing are different actions** (specification 7.12) — one button never
  does both.

**`client/src/App.tsx`** — add the three routes of specification 6 inside the
existing `AppLayout` route, wrapped in one more guard:

```tsx
<Route element={<ProtectedRoute roles={["teacher", "admin"]} />}>
  <Route path="/manage/courses" element={<CourseListPage />} />
  <Route path="/manage/courses/new" element={<CourseCreatePage />} />
  <Route path="/manage/courses/:courseId/edit" element={<CourseEditPage />} />
</Route>
```

Do not restructure the existing route tree and do not move the catch-all. This
nesting keeps the sidebar and sends a student to `/forbidden`.

**`client/src/components/layout/navItems.ts`** — specification 5.1 requires
«Мои курсы» for a teacher and allows it to be a filter of the catalogue. The
item needs the user's id, so the function takes the user:

```ts
export type NavItem = { to: string; label: string };
export function getNavItems(user: PublicUser): NavItem[];

/** «Каталог курсов» and «Мои курсы» share a path and differ only by query. */
export function isNavItemActive(item: NavItem, pathname: string, search: string): boolean;
```

A teacher gets «Каталог курсов» → `/manage/courses`, «Мои курсы» →
`/manage/courses?authorId=<id>`, «Личный кабинет». The administrator's items are
unchanged: specification 5.1 does not ask for «Мои курсы» there.

`isNavItemActive` splits the item's `to` on `?`. The path matches when it equals
`pathname`, or when `pathname` starts with it followed by `/`. When the item
carries an `authorId`, the location's `authorId` must equal it; when it does
not, the location must not carry one. `AppLayout` uses this instead of
`NavLink`'s own `isActive`, which ignores the query string and would light both
items at once. Keep `NavLink` for rendering and pass the class through its
`className` callback.

## Tests

One file, no database, no environment stubbing:

**`server/src/courses/courseQuery.test.ts`**

- `escapeRegExp` escapes the metacharacters, so `buildCourseFilter` on
  `search: "a("` produces a filter matching that text literally and no broken
  pattern;
- a query carrying only defaults produces a filter with no keys;
- `search` produces an `$or` over `title` and `shortDescription`;
- `category`, `audience`, `status` and `authorId` each add exactly their own
  key, and an absent parameter adds nothing;
- `buildCourseSort` maps `asc` and `desc` and always ends with `_id` in the same
  direction.

Build the inputs with `coursesQuerySchema.parse({ ... })` so the tests exercise
the real defaults instead of a hand-made object.

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

Check by hand, with a cookie jar, and report what each returned:

1. `GET /api/courses` as `student@lms.local` → `403` `forbidden`.
2. `GET /api/courses` as `teacher@lms.local` with no parameters → `200`,
   `meta.page === 1`, `meta.pageSize === 10`. This is the Express 5 query check
   from the route section.
3. `GET /api/courses?pageSize=7` → `422` `validation_error` naming `pageSize`.
   `GET /api/courses?search=a(` → `200`, not `500`.
4. `POST /api/courses` as the teacher → `201`, `status: "draft"`, `author` is
   the teacher, `lessonsCount: 0`. Keep the id.
5. Register a second teacher through the UI, set their role to `teacher`
   directly in MongoDB, and with their cookie:
   `GET /api/courses/<id>` → `403` `forbidden`;
   `PATCH /api/courses/<id>` → `403` `forbidden`;
   `DELETE /api/courses/<id>` → `403` `forbidden`.
   This is the acceptance check of the slice — quote all three responses.
6. `PATCH /api/courses/<id>` as `admin@lms.local` → `200`, changes applied.
7. `POST /api/courses/<id>/publish` → `422` `course_not_publishable` with
   `fields` containing `lessons`. Quote the body.
8. Set that course's `status` to `"published"` directly in MongoDB, then:
   `DELETE /api/courses/<id>` → `409` `course_delete_forbidden`;
   `POST /api/courses/<id>/archive` → `200`, `status: "archived"`,
   `publishedAt` unchanged;
   `POST /api/courses/<id>/archive` again → `409` `conflict`.
9. `GET /api/courses/abc` → `422` `validation_error`, not `500`.
10. In the browser as the teacher: the catalogue shows its four states; typing
    in the search updates the URL once after the pause and resets the page to 1;
    the browser's back button restores the previous filters; a foreign course
    shows no action buttons; opening a foreign course's edit URL directly lands
    on `/forbidden`; deleting a draft asks for confirmation in the modal and the
    row disappears.
11. As `admin@lms.local`: the same catalogue, with the actions available on the
    teacher's course.
12. Confirm no course response carries a field outside `courseSchema` —
    `authorId`, `_id` and `__v` must not appear anywhere.

Then remove what you created: the second teacher's account and every course made
during verification. The database is shared with the developer. Then stop every
process you started — `AGENTS.md` 8. Leave the container running.

## Hand over

Write the self-report to `.codex/reports/slice-03.md` in the form of
`AGENTS.md` 8, make exactly one commit, and stop.

State explicitly in the report:

1. the three responses of verification step 5, quoted;
2. the body of verification step 7, quoted;
3. whether `validate(..., "query")` survived Express 5 (step 2), and what you
   saw;
4. the state of the database when you finished: what you created and what you
   removed;
5. any file you touched that is not on the list above, and why;
6. anything you had to decide that this prompt left open — those are prompt
   defects and are wanted in the report even when your choice was obvious.
