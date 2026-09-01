# Slice 03 self-report

## Completed

- Added the `Course` model, indexes, populated-author types, and exact response mappers. Every course response is parsed through the matching `shared/` schema and exposes no Mongoose-only fields.
- Added pure catalogue filter/sort helpers with escaped substring regular expressions, optional filters, stable `_id` tie-breaking, and the specified database-free tests.
- Added the centralized entity-level ownership loader. It checks existence before authorship and permits only the author or an administrator on every `/:courseId` route.
- Added course CRUD and lifecycle routes with router-level authentication/role checks, parameter/body validation, server-side pagination/counting, publication issues, draft-only deletion, and archive behavior that preserves `publishedAt`.
- Added the reusable debounce hook, accessible scrollable `Table`, and `Pagination` built from the shared page-size constants.
- Added typed course API wrappers and the Redux course slice. Catalogue requests reject stale responses by request id; detail errors remain machine-readable; lifecycle results update list/detail state; deletion is followed by a server refetch.
- Added course labels/permissions and the shared React Hook Form course form using the shared Zod schema, field/general server errors, and in-flight/validity submission guards.
- Added the URL-driven catalogue with debounced search/category, filters, sorting, page reset, four render states, table actions, confirmations, lifecycle errors, and pagination.
- Added create/edit pages, save success feedback, separate publication/lifecycle actions, direct forbidden/not-found handling, and the three protected course routes.
- Added teacher «Мои курсы» navigation with query-aware active-state handling while preserving the administrator and student navigation sets.

## Verification

- `npm install` — passed; dependencies were already current, 447 packages audited, 0 vulnerabilities.
- `npm run build` — passed for `shared`, `server`, and `client`. Vite emitted the existing non-failing Rollup warnings about annotation comments in installed Zod files.
- `npm run typecheck` — passed for all three workspaces.
- `npm run lint` — passed.
- `npm run test` — passed: 17 server tests and 2 client tests.
- `npm run db:up` — passed; the existing `lms-mongo` container remains running.
- `npm run seed` — passed; all three seeded users were already present.
- `npm run dev` — Express listened on 4000 and Vite on 5173. Both were stopped after verification, and neither port remained listening.

Manual API results:

1. Student catalogue request returned `403 {"code":"forbidden","message":"Недостаточно прав"}`.
2. A bare teacher `GET /api/courses` returned `200 {"items":[],"meta":{"page":1,"pageSize":10,"total":0,"totalPages":0}}`. `validate(..., "query")` therefore survived Express 5: the handler received the coerced defaults `page: 1` and `pageSize: 10`.
3. `GET /api/courses?pageSize=7` returned `422` with `validation_error` and a `pageSize` field error. `GET /api/courses?search=a(` returned `200`, not `500`.
4. Teacher course creation returned `201`, `status: "draft"`, the seeded teacher as author, `publishedAt: null`, and `lessonsCount: 0`.
5. With the second teacher's cookie, the three ownership responses were:

   - `GET`: `403 {"code":"forbidden","message":"Недостаточно прав"}`
   - `PATCH`: `403 {"code":"forbidden","message":"Недостаточно прав"}`
   - `DELETE`: `403 {"code":"forbidden","message":"Недостаточно прав"}`

6. The administrator PATCH returned `200` with the requested title change. A second title-only PATCH confirmed that omitted `description` remained unchanged after the update-key handling described below.
7. The publication response body was `422 {"code":"course_not_publishable","message":"Курс нельзя опубликовать: не выполнены условия","fields":[{"field":"lessons","message":"Добавьте хотя бы один опубликованный обязательный урок"}]}`.
8. After setting the temporary course to a realistic published state in MongoDB, delete returned `409 course_delete_forbidden`; archive returned `200` with `status: "archived"` and the unchanged `publishedAt: "2026-09-01T16:31:00.000Z"`; a repeated archive returned `409 conflict`.
9. `GET /api/courses/abc` returned `422 validation_error` naming `courseId`, not `500`.
10. Browser verification as the second teacher showed the catalogue controls/data state, filtered empty state, query-aware sidebar, no actions on the foreign course, and `/forbidden` after opening its edit URL. Search updated the URL once after the pause, reset page 4 to page 1, and `history.back()` restored the prior URL and input. A draft created through the UI opened the edit form, required a named confirmation modal for deletion, and disappeared after confirmation. The initial loader and retryable error branches are present in the page state switch; no artificial server failure was introduced into the shared development environment.
11. Browser verification as `admin@lms.local` showed the same teacher-authored archived course with its permitted «Редактировать» and «Опубликовать» actions. The browser console contained no warnings or errors.
12. Observed create, list, detail/update, and lifecycle responses contained only contract fields. `authorId`, `_id`, `__v`, and `description` in list items did not leak.

## Departures, prompt defects, and decisions

- `updateCourseBodySchema` is `createCourseBodySchema.partial()`, but Zod still applies the nested `description` default. Consequently, validating `{"title":"..."}` produces a parsed body that also contains `description: ""`. Assigning the parsed object directly erased an omitted description during the first live administrator PATCH. Nothing under `shared/` was changed. The listed course route now captures the raw submitted key set before `validate(updateCourseBodySchema)` and explicitly assigns only those validated fields. This is a departure from the prompt's implied direct assignment and is necessary to satisfy its explicit “only fields present in the body” rule.
- The statement that every mutating route validates its body was interpreted as every mutating route that accepts a body. The prompt/shared package supplies body schemas only for create and update; delete, publish, and archive accept no body, and their route descriptions specify no empty-body schema.
- Lifecycle controls that would only produce an already-in-state conflict are hidden: published courses do not show publish, archived courses do not show archive, and delete appears only for drafts. The prompt fixed action availability and server conflicts but did not explicitly say whether already-in-state controls should remain visible.
- `toSearchParams` retains non-empty schema defaults (`page`, `pageSize`, `sortBy`, `sortOrder`) and omits optional empty values. The prompt required empty omission but did not require default omission.
- Russian texts for field-level publication issues other than the exact lesson issue, empty/success states, and generic form/action failures were not fixed verbatim by the prompt; clear contract-compatible texts were used.

## Files outside the implementation list

- `.codex/reports/slice-03.md` — required by the handover section.
- No other file outside the create/modify lists was changed. `package-lock.json` did not change, and nothing under `shared/` was modified.

## Database and process state

- Created through verification: course `6a96fc44ad1cf6618c8b9b7b`, temporary account `slice03-second-teacher@lms.local` (`6a96fd15ad1cf6618c8b9b7f`), and UI draft course `6a970038750d3a17121dd9d9`.
- The UI draft was deleted through its confirmation flow. Cleanup then removed the remaining course and the temporary account; the final query reported `remainingVerificationCourses: 0` and `remainingVerificationUsers: 0`.
- The four temporary cookie jars were removed. Seeded users and unrelated developer data were not changed.
- Vite, Express, and the browser automation session were stopped. The shared MongoDB container was deliberately left running.

## Blocked or incomplete work

- None.

## Out-of-scope observations

- Docker Compose repeated the existing warning that `lms-mongo-data` was not originally created by the current Compose project. The shared container operated normally and was left unchanged.
- Vite/Rollup repeated the existing removable-annotation warnings from installed Zod sources; the production build succeeded.
