# Slice 14 — frontend tests for the slice 13 behaviour

Read `AGENTS.md` first. It outranks this prompt. The specification outranks
both.

Slice 13 shipped two things nothing tests: the unsaved-changes guard (5.3) and
the answer breakdown after a submitted attempt (18.2). Both were checked by
reading code only — no browser, no manual pass. This slice turns the parts that
a jsdom test can actually prove into tests, so that the guard cannot rot
silently on the next router change.

**Do not touch `server/` or `shared/`. Do not change any component under test.**
If a test cannot be written without changing the component, stop and hand back:
that is a defect report, not a licence to edit.

## Before you start — read these

- `client/src/routes/UnsavedChangesGuard.tsx` — `useBlocker` with two filters on
  top of `when`, the stale-block release effect, the `beforeunload` effect.
- `client/src/routes/ProtectedRoute.test.tsx` — how this project builds a store
  with `configureStore` + `preloadedState` and renders through a router.
- `client/src/features/learning/TestAttemptForm.test.tsx` — how it renders
  through `createMemoryRouter` + `RouterProvider`. Copy that shape.
- `client/src/components/ui/Modal/Modal.test.tsx` — the dialog is a portal with
  `role="dialog"`; `screen` finds it.
- `client/src/features/learning/AttemptReview.tsx` and `shared/src/tests.ts`
  (`attemptReviewQuestionSchema`) — build fixtures with
  `attemptReviewQuestionSchema.parse({...})`, the way the other tests build
  theirs.
- `client/src/pages/AdminUserDetailPage.tsx` — one guard over the OR of two
  forms' dirty flags, fed by `onDirtyChange`. This is the arrangement test C
  defends.
- `client/src/features/users/adminUsersSlice.ts` — `fetchAssignableCourses`
  calls `requestCourses` from `client/src/features/courses/coursesApi.ts`. That
  module is what test C mocks.

## Files

Write (new):

- `client/src/routes/UnsavedChangesGuard.test.tsx`
- `client/src/features/learning/AttemptReview.test.tsx`
- `client/src/pages/AdminUserDetailPage.test.tsx`

Change: nothing. Delete: nothing. Add no dependency — `@testing-library/react`,
`@testing-library/jest-dom`, `vitest` and `react-router-dom` 7 are installed,
and `client/src/setupTests.ts` already loads the jest-dom matchers.

**If the gate turns up a file this list forgot, fix it minimally and name it in
the report — do not stop.** That licence covers a fixture or a stale import. It
does not cover a component under test: changing one is a new decision and stops
the slice.

## Decisions already made — implement, do not reconsider

### A. `UnsavedChangesGuard.test.tsx`

Render a memory router. The `/form` route holds a small harness component with
the guard plus a `Link` to each destination a case needs; the destination routes
hold a heading you can assert on.

```tsx
const router = createMemoryRouter(
  [
    { path: "/form", element: <Harness when={when} /> },
    { path: "/elsewhere", element: <h1>Другая страница</h1> },
    { path: "/login", element: <h1>Вход</h1> },
  ],
  { initialEntries: ["/form"] },
);
```

Seven cases, each named after the behaviour, not the implementation:

1. `when` true, click the link to `/elsewhere` → the dialog appears
   (`screen.getByRole("dialog")` with the accessible name «Покинуть страницу?»)
   and the destination heading is **not** rendered.
2. From that state, «Остаться» → dialog gone, still on `/form`.
3. From that state, «Уйти без сохранения» → destination heading rendered.
4. `when` false → the link navigates with no dialog at all.
5. `when` true, navigate to the **same** pathname with a different search
   (`/form?page=2`) → no dialog. This is the filter that keeps a filter or a
   page number from asking.
6. `when` true, navigate to `/login` → no dialog. Signing out and an expired
   session both arrive this way, and staying cannot save the form.
7. `when` true and blocked, then `when` flips to false while the dialog is open
   → the dialog disappears on its own and the navigation is released. Drive the
   flip from the harness component's own state, not by building a second
   router. This is the regression test for the stale-block release effect;
   without it a form saved from under an open dialog leaves the dialog stuck.

Then one `beforeunload` case, in the same file: dispatch
`new Event("beforeunload", { cancelable: true })` on `window` and assert
`defaultPrevented` is true while `when` is true, and false after `when` turns
false. If jsdom cannot make that assertion, say so in the report and drop the
case — do not fake it with a spy on `addEventListener`, which proves only that
a listener was attached.

### B. `AttemptReview.test.tsx`

Fixtures through `attemptReviewQuestionSchema.parse`. Four cases:

1. `review={[]}` renders nothing — the heading «Разбор ответов» is absent and
   the component produces no content at all.
2. A question answered wrongly: «Неверно» is shown, the option the learner
   picked carries «ваш выбор» and **not** «правильный ответ», and the correct
   option the learner missed carries «правильный ответ» and **not** «ваш
   выбор». Assert inside each option row with `within`, not on the whole
   document: the point of the case is that the two labels are independent.
3. A question with no selected option shows «Вы не ответили».
4. Two questions render in array order, and an option that is both correct and
   selected carries both labels while its question shows «Верно».

### C. `AdminUserDetailPage.test.tsx`

This is the regression test for the fix that closed slice 13. React Router keeps
**one** blocker per router and consults only the last registered one, so a guard
placed inside each of the page's two forms would have let the other form's
`when` decide. The page owns a single guard over the OR of both flags.

Setup:

- `vi.mock` `../features/courses/coursesApi` so `requestCourses` resolves a page
  holding one published course; that is what `AssignmentForm` lists.
- `configureStore` with the `auth` and `adminUsers` reducers and
  `preloadedState` carrying an authenticated admin and a ready
  `adminUsers.detail` built with `adminUserDetailSchema.parse({...})` and
  `assignments: []`. Read the slice for the exact state shape — do not guess it.
- `createMemoryRouter` with `/admin/users/:userId` → `<AdminUserDetailPage />`,
  an `/admin/users` route with a heading, and `initialEntries` at the detail
  page. The page's own «Назад к пользователям» link is the navigation you click.

Three cases:

1. Type into «Имя», click «Назад к пользователям» → the dialog appears.
2. Leave the name alone, choose a course in «Опубликованный курс», click the
   same link → the dialog appears. **This is the case a per-form guard would
   have failed**; say so in a comment above it.
3. Touch neither form, click the link → no dialog, the user list heading is
   rendered.

Wait for the assignable courses to load before acting in case 2 — the form shows
a `Loader` until then.

## What this slice does not do

- No test for `AssignmentForm` on its own: its four lines mirror
  `AdminUserForm`, and case C2 already proves the wiring end to end.
- No test of the router migration itself. `router.tsx` is a static table, and a
  test that re-lists it would be the table written twice.
- No browser, no real `beforeunload` prompt, no tab close, no unknown-URL check
  without a session. Those stay on the developer's manual checklist.
- No WCAG work, and no change to any component, style or token.

## Gate

From the repository root, in this order:

```
npm run build && npm run typecheck && npm run lint && npm run test
```

Do not open a browser. Do not start `npm run dev`. Do not run `npm run seed`.

## Self-report

`.codex/reports/slice-14.md`, in the format of `AGENTS.md` (8). Section 5 —
«claim → check → result», one line per claim including the ones that held — is
mandatory and must cover at least:

- every case listed above exists and passes, or is named as dropped with the
  reason;
- nothing outside the three new test files changed (`git diff --stat` against
  the commit before yours);
- the count of client tests before and after.

There is no manual checklist this time: nothing here needs the application
running. End the report at section 6. One commit, no push, no amend.
