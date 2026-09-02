# Slice 06 (client half) — users and assignments

Read `AGENTS.md` first. It outranks this prompt. The specification outranks
both.

The server half of this slice is written, reviewed and accepted. You write the
client half only. **Do not touch anything under `server/` or `shared/`.**

## Goal

An administrator manages people: a list of users with search, filters, sorting
and server-side pagination; the card of one user with their assignments; an
edit of the name, role, group and status; assigning a published course and
revoking an assignment (specification 7.14, 4.1, 4.3).

Every route of this slice is administrator-only. A teacher or a student who
types the URL must land on `/forbidden`, and that is the existing
`ProtectedRoute` — do not invent a second check.

## Before you start — read the server, then stop if it disagrees

This prompt was written from `.claude/specs/slice-06-server.md` and from the
code that implements it. Read `server/src/routes/adminUsers.ts` and
`server/src/routes/userAssignments.ts` — two short files — and confirm the
routes, bodies and refusals of the next section. Do not start the dev server
and do not open a browser to do it (`AGENTS.md` 9).

If any route is missing, differently named, or answers a different shape:
**stop, write what you found to `.codex/reports/slice-06-client.md`, and hand
back without writing client code.**

## Given

- `shared/` is written and compiled. **Do not modify it.** This slice needs
  `adminUsersQuerySchema`, `adminUserListItemSchema`, `adminUserDetailSchema`,
  `adminUpdateUserBodySchema`, `assignmentSchema`, `createAssignmentBodySchema`,
  `publicUserSchema`, the types `AdminUsersQuery`, `AdminUserListItem`,
  `AdminUserDetail`, `AdminUpdateUserBody`, `Assignment`,
  `CreateAssignmentBody`, `ListResponse`, `ListMeta`, `CourseListItem`, and the
  constants `USER_ROLES`, `USER_STATUSES`, `USER_SORT_FIELDS`,
  `ASSIGNMENT_STATUSES`, `SEARCH_DEBOUNCE_MS`, `SEARCH_MAX_LENGTH`,
  `GROUP_NAME_MAX_LENGTH`. Import them. If one looks wrong, stop and report —
  do not edit it.
- Slices 01–05 are accepted. `apiRequest`, `ApiError`, `toFormError`,
  `FormError`, the store, `ProtectedRoute`, `AppLayout`, `useDebouncedValue`,
  `ROLE_LABELS` (in `components/layout/navItems.ts`, already imported by
  `ProfilePage`), `COURSE_STATUS_LABELS` and the UI primitives exist. Reuse
  them, do not rewrite them.
- **Read these four files before writing anything.** Your files are their shape
  with different fields: `client/src/pages/CourseListPage.tsx`,
  `client/src/features/courses/coursesQueryParams.ts`,
  `client/src/features/courses/coursesSlice.ts`,
  `client/src/features/lessons/LessonForm.tsx`. Follow their conventions —
  thunk per request, the `requestId` race guard on a list, `FormError` returned
  out of `onSubmit`, the local `ActionError` block, the
  loading / empty / error / data ladder, `useForm<Input, unknown, Output>` over
  `z.input<typeof schema>` — rather than inventing parallel ones.

## The API you are building against

All five routes require the session cookie and the role `admin`; any other role
answers `403`.

| Method and path | Body | Answer |
|---|---|---|
| `GET /admin/users` | — (`adminUsersQuerySchema` in the query string) | `200` + `ListResponse<AdminUserListItem>` |
| `GET /admin/users/:userId` | — | `200` + `AdminUserDetail` |
| `PATCH /admin/users/:userId` | `adminUpdateUserBodySchema` | `200` + `AdminUserDetail` |
| `POST /admin/users/:userId/assignments` | `createAssignmentBodySchema` | `201` + `Assignment` |
| `DELETE /admin/users/:userId/assignments/:assignmentId` | — | `200` + `Assignment` |

The `DELETE` is not a deletion and is not a `204`: the row survives with
`status: "revoked"` and a server-set `revokedAt`, and it comes back in the body.
Render what comes back; never write a timestamp or a status yourself.

Refusals you must render, all of them carrying a Russian `message`:

- `422 validation_error` with `fields` — a body the schema rejects.
- `422 self_modification_forbidden` with `fields` naming `role` and/or `status`
  — the administrator tried to demote, block or archive their own account
  (specification 4.1).
- `422 unprocessable` with `fields` — assigning a course that is not
  `published` (`field: "courseId"`), or assigning to a user that is not
  `active` (`field: "userId"`).
- `409 assignment_exists` — the pair already has an active assignment;
  `409 assignment_not_active` — that assignment was revoked already.
- `404 not_found` — no such user or assignment, and any unparseable id in the
  path; `403 forbidden` — not an administrator.

## Decisions already made — implement, do not reconsider

1. **`PATCH` replaces the whole user.** `adminUpdateUserBodySchema` has no
   `.partial()` and no optional key: `name`, `role`, `groupName` and `status`
   are all required. Always submit all four from the loaded user. A body
   carrying only what changed fails validation outright — there is no
   "send the diff" path here. The schema knows no `email`: do not put an email
   field in the form, editable or not.
2. **An empty filter value is never sent.** `role=` and `status=` do not parse
   and answer `422`, which would blank the whole list. Serialise the query the
   way `coursesQueryParams.ts` does — it skips `undefined` and `""` — and clear
   a filter by passing `undefined`, as `CourseListPage` does with
   `value || undefined`.
3. **The `PATCH` answer is the whole card — write it into the store, never
   refetch.** A refetch blanks `detail.user` on `pending` and unmounts the open
   form under the administrator. When the same user is also a row of the loaded
   list, replace that row too, and **carry the row's existing
   `activeAssignmentsCount` across**: `AdminUserDetail` does not carry the
   count, and `adminUserListItemSchema.parse` rejects the row without it.
4. **Assignment answers are spliced in, not refetched either.** `POST` returns
   the new `Assignment`: prepend it to `detail.user.assignments` (the server
   sorts by `assignedAt` descending) and add one to the list row's
   `activeAssignmentsCount`. `DELETE` returns the revoked `Assignment`: replace
   it by id and subtract one, never below zero. A revoked assignment stays in
   the table — the history is the point (specification 4.3).
5. **The self-modification rule is the server's, and the form does not
   re-implement it.** Do not disable the role and status fields on one's own
   card and do not block the submit; copy the `fields` of
   `self_modification_forbidden` onto the form with `form.setError` and put the
   `message` in the general error, as `LessonForm` does. A static hint above the
   form on one's own card ("Собственные роль и статус изменить нельзя") is
   allowed; a client-side check that decides the outcome is not.
6. **The course picker is one `Select` fed by
   `GET /courses?status=published&sortBy=title&sortOrder=asc&pageSize=50`,**
   through the existing `requestCourses` of `features/courses/coursesApi.ts` —
   do not write a second courses API module. Store the result in the new slice,
   **not** in `coursesSlice.list`: that list belongs to `/manage/courses`, and
   overwriting it would leave the catalogue showing a filtered page on return.
   `PAGE_SIZES` stops at 50, so when `meta.total` exceeds the number of loaded
   items, render one line under the select saying the list is capped — do not
   paginate the picker. Disable the option of a course the user already has an
   active assignment for: it prevents most `409 assignment_exists`, and you
   still render the ones that arrive. Disable, do not hide.
7. **Assignment errors split by field.** In the assign form, a `fields` entry
   whose `field` is `courseId` goes to the select through `form.setError`;
   everything else — `userId`, and any error without `fields`, both `409`s
   included — goes to the general message. The user's own status is not a form
   field and must not be turned into one.
8. **`groupName` is a plain text `Input`.** `groupNameSchema` trims and turns
   `""` into `null` itself, so seed the field with `user.groupName ?? ""`, type
   the form as `useForm<z.input<typeof adminUpdateUserBodySchema>, unknown,
   AdminUpdateUserBody>` and let the resolver convert. Do not normalise the
   empty string in the component, and do not add a "clear the group" checkbox.
9. **Two `Modal` confirmations, both in the shape `CourseListPage` uses for
   archive and delete.** Revoking an assignment, naming the course. And saving
   the edit form **when the submitted `role` or `status` differs from the loaded
   user's** — specification 7.14 requires a confirmation for those two fields
   and only for them. Compare against `user.role` and `user.status`, name in the
   modal what changes and to what, and submit from the modal's confirm button; a
   submit that touches only `name` or `groupName` saves without asking. This is
   presentation, not a rule: the server still decides, and the refusals of
   decision 5 are rendered the same way whichever path the submit took.
10. **When the administrator edits their own card, the session copy is
    updated.** `AppLayout` and `/profile` read `state.auth.user`, so a renamed
    administrator would keep the old name in the header until a reload. Add one
    `extraReducers` case to `authSlice`: on `updateAdminUser.fulfilled`, when
    `state.user?.id === action.payload.id`, set
    `state.user = publicUserSchema.parse(action.payload)`. `authSlice` imports
    from the new slice and not the other way round — the direction
    `coursesSlice` already uses for `lessonsSlice`.
11. **The page clamp must compare against its own answer.** In the effect that
    pulls `query.page` back to the last page, return early when
    `list.meta.page !== query.page` — the meta may still be the previous
    request's, and clamping against it walks the administrator off a page they
    asked for. `CourseListPage` has the same defect and gets the same two lines:
    the guard, and `list.meta.page` added to the dependency array. **That is the
    entire change to `CourseListPage.tsx`** — nothing else in that file moves.
12. **`/admin` is slice 09 and stays a 404.** The sidebar already links to it
    and to `/admin/users`, and `getStartPath` already sends an administrator to
    `/admin`. Both are the expected intermediate state. Do not create a
    dashboard, do not edit `navItems.ts`, do not redirect `/admin` anywhere.

## Files

New, under `client/src/features/users/`:

- `usersApi.ts` — `requestAdminUsers(query)`, `requestAdminUser(userId)`,
  `requestAdminUserUpdate(userId, body)`,
  `requestAssignmentCreate(userId, body)`,
  `requestAssignmentRevoke(userId, assignmentId)`. Same shape as `coursesApi.ts`.
- `adminUsersQueryParams.ts` — `readAdminUsersQuery(params)` and
  `toSearchParams(query)` over the keys `page`, `pageSize`, `search`, `sortBy`,
  `sortOrder`, `role`, `status`, `groupName`: `coursesQueryParams.ts` with those
  keys and `adminUsersQuerySchema`.
- `adminUsersSlice.ts` — state
  `{ list: { items: AdminUserListItem[]; meta: ListMeta; status: LoadStatus;
  requestId: string | null }; detail: { user: AdminUserDetail | null; status:
  LoadStatus; error: FormError | null }; assignableCourses: { items:
  CourseListItem[]; total: number; status: LoadStatus } }`; thunks
  `fetchAdminUsers`, `fetchAdminUser`, `updateAdminUser`,
  `fetchAssignableCourses`, `createAssignment({ userId, body })` and
  `revokeAssignment({ userId, assignmentId })`, each rejecting with `FormError`.
  Reuse the `LoadStatus` exported by `coursesSlice`. Decisions 3 and 4 live in
  this file.
- `userFormat.ts` — `USER_STATUS_LABELS`, `ASSIGNMENT_STATUS_LABELS` and
  `formatDateTime(value: string): string` for `lastLoginAt`, `assignedAt` and
  `revokedAt` (`toLocaleString("ru-RU")`; a `null` renders as a dash at the call
  site). Role labels come from the existing `ROLE_LABELS` — do not write a
  second copy.
- `AdminUserForm.tsx`, `AdminUserForm.module.css` — props `{ user:
  AdminUserDetail; isSelf: boolean; onSubmit: (body: AdminUpdateUserBody) =>
  Promise<FormError | null> }`. Name `Input`, role `Select`, group `Input`
  (`maxLength={GROUP_NAME_MAX_LENGTH}`), status `Select`.
- `AssignmentList.tsx`, `AssignmentList.module.css` — props `{ userId: string;
  assignments: Assignment[] }`. A `Table`: course title, course status,
  assignment status, who assigned, assigned at, revoked at, progress, and a
  "Снять" button on the active rows only. The revoke `Modal`, its loading flag
  and a local `ActionError` live here. `EmptyState` when there are none.
- `AssignmentForm.tsx`, `AssignmentForm.module.css` — props `{ userId: string;
  assignments: Assignment[] }`. Loads the assignable courses on mount, renders
  the `Select` of decision 6 and a submit button, dispatches `createAssignment`.

New, under `client/src/pages/`:

- `AdminUserListPage.tsx`, `AdminUserListPage.module.css` — `/admin/users`.
  Debounced search and group inputs (`SEARCH_DEBOUNCE_MS`, with `maxLength` from
  `SEARCH_MAX_LENGTH` and `GROUP_NAME_MAX_LENGTH`), role, status and sort
  `Select`s, the sort-order button, `Table`, `Pagination`. Columns: name, email,
  role, group, status, `activeAssignmentsCount`, `lastLoginAt`, and a `Link` to
  the card. Both empty states, as in `CourseListPage`: nothing at all, and
  nothing under the current filter.
- `AdminUserDetailPage.tsx`, `AdminUserDetailPage.module.css` —
  `/admin/users/:userId`. Loads the user, renders `AdminUserForm`,
  `AssignmentForm` and `AssignmentList`, and handles loading / error / ready. A
  `404` or `403` is rendered from `detail.error.code`, not as a blank page.

Edited, and only in the ways named:

- `client/src/App.tsx` — a `<Route element={<ProtectedRoute roles={["admin"]}
  />}>` block holding the two routes above, a sibling of the existing
  `roles={["teacher", "admin"]}` block.
- `client/src/store/index.ts` — register `adminUsersReducer` as `adminUsers`.
- `client/src/features/auth/authSlice.ts` — the one `extraReducers` case of
  decision 10, and nothing else.
- `client/src/pages/CourseListPage.tsx` — the two lines of decision 11.

Nothing else.

## Not in this slice — do not add it

- `GET /admin/dashboard`, `/admin/statistics`, any counter or chart — slice 09.
- Anything a learner sees, `/learning`, progress computation — slices 07 and 08.
  `assignment.progressPercent` is `0` for everyone right now and that is the
  correct value, not a placeholder: display it, do not hide the column, do not
  special-case zero, do not compute anything from the assignments.
- Deleting a user. There is no such route: archiving is `PATCH` with
  `status: "archived"` (specification 4.1).
- Changing another user's email or password from the administrative form.
- Groups as an entity, a group dropdown, assigning a course to a group
  (specification 1.4).
- New UI primitives, new dependencies, a shared `ActionError` module extracted
  out of `CourseListPage`. If you need something beyond the list above, stop and
  report instead of inventing it.

## Verification

The machine gate, once, at the end, from the repository root:

```
npm run typecheck && npm run lint && npm run build && npm run test
```

One line of result each in the report. Do not run `npm run seed`, do not start
`npm run dev`, do not open a browser (`AGENTS.md` 9).

## Hand over

Write `.codex/reports/slice-06-client.md` in the format of `AGENTS.md` 8 and end
it with a numbered `## Проверить руками` checklist for the developer: each item
naming the URL, the input, and the result that means success. Start it from
`/admin/users` under `admin@lms.local`. The seed leaves six users — among them
`blocked@lms.local` with `status: "blocked"`, `student@lms.local` in group
«Смена А» and `student2@lms.local` in «Смена Б» — and exactly one published
course, «Правила технической эксплуатации», the only one that can be assigned.
The developer's database already carries two assignments on `student@lms.local`
from the review of the server half, one `active` and one `revoked`: that is the
ready-made case for a revoked row in the table and for `409 assignment_exists`.
Use `student2@lms.local` for the successful assignment, and say in each item
which user it expects to be free. Commit once, do not push, and stop.
