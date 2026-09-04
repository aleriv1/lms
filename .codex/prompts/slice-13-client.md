# Slice 13, client half — the unsaved-changes warning, and the answer breakdown on screen

Read `AGENTS.md` first. It outranks this prompt. The specification outranks
both.

This is the last slice. It closes two of the four items listed in specification
18.3: the warning when leaving a page with unsaved changes (5.3) and the
detailed answer breakdown after a test (18.2). The other two — the login rate
limit and WCAG 2.1 AA — are not yours. The rate limit is the server half; WCAG
is measured in a review session, so **do not touch colours, contrast, focus
outlines or `styles/tokens.css`**.

**Check first that the server half is in.** `git log --oneline -5` should show
its commit, and `shared/src/tests.ts` must export `attemptReviewQuestionSchema`
with `attemptResultSchema` carrying a required `review`. If it does not, stop
and hand back: half of this prompt renders that field.

## Goal

- Leaving a page with an edited, unsaved form asks first — both an in-app
  navigation and closing the tab. Today no form does: `client/src/App.tsx` is on
  `BrowserRouter`, and neither `useBlocker` nor `beforeunload` appears anywhere
  in `client/src`.
- The result screen of a submitted attempt shows, per question, whether it was
  answered correctly, which options the learner chose and which were right.

The warning is why the router migrates. `useBlocker` needs a data router, so
`BrowserRouter` becomes `createBrowserRouter` + `RouterProvider`. That is one
change for every form in the project, and it is the reason the two items share a
slice.

**Do not touch `server/` or `shared/`.**

## Before you start — read these, then obey what they say

- `client/src/App.tsx` — every route, `RootRedirect`, `PublicNotFoundPage`, and
  the `isAuthenticated` branch around the two `path="*"` routes. That branch is
  the only part of the migration that is not mechanical; decision 1 replaces it.
- `client/src/main.tsx` — `<Provider store>` wraps `<App />`.
- `client/src/components/layout/AppLayout.tsx` — the sidebar and `<Outlet />`.
- `client/src/routes/ProtectedRoute.tsx` — four branches, unchanged by this
  slice.
- `client/src/features/courses/CourseForm.tsx` — the shape every form of this
  project follows: React Hook Form, `mode: "onChange"`, `handleSubmit`,
  `formState.isSubmitting`.
- `client/src/pages/CourseCreatePage.tsx` — how a page navigates away **inside**
  `onSubmit`, while `isSubmitting` is still true. Decision 3 depends on this.
- `client/src/components/ui/Modal/Modal.tsx` — `isOpen`, `title`, `onClose`,
  `children`, `footer`; it traps focus, handles Escape and restores focus. The
  warning uses it; do not write a second dialog.
- `client/src/pages/LearningTestPage.tsx` — the `<section aria-label="Результат
  попытки">` block that shows a finished attempt.
- `client/src/features/learning/TestAttemptForm.tsx` — `answeredCount`,
  `isSending`, and the existing unanswered-questions `Modal`.
- `shared/src/tests.ts` — `attemptReviewQuestionSchema`, `attemptReviewOptionSchema`.

Stop and hand back only if something structural is missing.

## Files

Write (new):

- `client/src/routes/router.tsx`
- `client/src/routes/RootRedirect.tsx`
- `client/src/routes/NotFoundRoute.tsx`
- `client/src/routes/UnsavedChangesGuard.tsx`
- `client/src/features/learning/AttemptReview.tsx`
- `client/src/features/learning/AttemptReview.module.css`

Delete:

- `client/src/App.tsx` — its contents move to the three new `routes/` files.

Change:

- `client/src/main.tsx`
- `client/src/components/layout/AppLayout.tsx`
- `client/src/features/courses/CourseForm.tsx`
- `client/src/features/lessons/LessonForm.tsx`
- `client/src/features/tests/TestForm.tsx`
- `client/src/features/users/AdminUserForm.tsx`
- `client/src/features/users/AssignmentForm.tsx`
- `client/src/pages/ProfileEditPage.tsx`
- `client/src/features/learning/TestAttemptForm.tsx`
- `client/src/features/learning/TestAttemptForm.test.tsx`
- `client/src/pages/LearningTestPage.tsx`

Do not add a dependency. `react-router-dom` 7 already exports
`createBrowserRouter`, `createMemoryRouter`, `RouterProvider` and `useBlocker`.

**If the gate turns up a file this list forgot, fix it minimally and name it in
the report — do not stop.** The list is written by someone reading, and reading
misses fixtures: the server half of this slice was handed a list missing
`server/src/contracts/sharedContracts.test.ts`, and the cheap answer was one
line plus a line in the report. That licence covers a test fixture or an import
the change makes stale. It does not cover a new decision: an architectural
choice still stops the slice.

## Decisions already made — implement, do not reconsider

### 1. The router

`client/src/routes/router.tsx` exports `router`, built once at module scope by
`createBrowserRouter` from the same route tree `App.tsx` has today, in the same
order and with the same paths. Building it at module scope is the point: a
router created inside a component would be rebuilt on every auth-status change
and remount every page.

`main.tsx` renders `<RouterProvider router={router} />` inside `<Provider
store={store}>`. `App.tsx` disappears.

`RootRedirect` moves to `client/src/routes/RootRedirect.tsx` unchanged.

The two `path="*"` routes and the `isAuthenticated` branch that chose between
them cannot survive: a static router has one `*`. Replace them with **one**
top-level `{ path: "*", element: <NotFoundRoute /> }`, where
`client/src/routes/NotFoundRoute.tsx` reads `state.auth.status` and branches:

- `idle` or `loading` → `<Loader />`;
- `error` → `<ErrorState onRetry={() => void dispatch(fetchSession())} />`.
  This is a **fix**, not a port: today an unknown URL on a failed session read
  answers "404" when the honest answer is "we could not check who you are".
- `authenticated` → `<AppLayout><NotFoundPage /></AppLayout>`, so a signed-in
  user keeps the sidebar, as they do today;
- otherwise → `<main><NotFoundPage /></main>`, which is what `PublicNotFoundPage`
  does today.

For the authenticated branch, `AppLayout` takes an optional `children`:
`{children ?? <Outlet />}` in its `<main>`, prop typed `children?: ReactNode`.
Nothing else in `AppLayout` changes — in particular **leave `handleLogout`
alone**. Its imperative `navigate("/login", { replace: true })` looks redundant
next to `ProtectedRoute`, and is not: `ProtectedRoute` redirects with
`state: { from: location }`, and `LoginPage` sends the *next* user to that
address after they sign in.

### 2. `UnsavedChangesGuard`

`client/src/routes/UnsavedChangesGuard.tsx` — one component, dropped into a
form, holding all three mechanisms. It lives in `routes/` and not in
`components/ui/` because it is coupled to the router, like `ProtectedRoute`.

```tsx
export type UnsavedChangesGuardProps = { when: boolean };
export function UnsavedChangesGuard({ when }: UnsavedChangesGuardProps): ReactNode;
```

Inside:

```tsx
const blocker = useBlocker(
  ({ currentLocation, nextLocation }) =>
    when &&
    currentLocation.pathname !== nextLocation.pathname &&
    nextLocation.pathname !== "/login",
);
```

Two filters on top of `when`, each for a reason:

- `currentLocation.pathname !== nextLocation.pathname` — a filter or a page
  number written into the query string of the same page is not leaving it.
- `nextLocation.pathname !== "/login"` — signing out and an expired session both
  arrive as a navigation to `/login`, and neither can be undone by staying: the
  form can no longer be saved. Asking there would be a dialog with no useful
  answer.

Render `Modal` when `blocker.state === "blocked"`:

- `title="Покинуть страницу?"`, body «Введённые данные не сохранены. Если уйти
  сейчас, они будут потеряны.»
- footer: a secondary «Остаться» calling `blocker.reset?.()` and a primary
  «Уйти без сохранения» calling `blocker.proceed?.()`.
- `onClose` (Escape, backdrop) calls `blocker.reset?.()` — the safe answer.

`proceed` and `reset` exist only while blocked; call them optionally.

Add an effect that releases a stale block: if `blocker.state === "blocked"` and
`when` has become false, call `blocker.reset()`. Without it a form that is saved
from under an open dialog leaves the dialog stuck.

Tab close is the second mechanism, in its own effect, active only while `when`:
add a `beforeunload` listener that calls `event.preventDefault()`, and remove it
on cleanup. The browser shows its own text; nothing you write appears there.

### 3. `when` is `isDirty && !isSubmitting`

For every React Hook Form form:

```tsx
<UnsavedChangesGuard when={form.formState.isDirty && !form.formState.isSubmitting} />
```

placed as the first child inside the `<form>` element — except on
`ProfileEditPage`, which has two forms and gets one guard outside both, as the
first child of the `<div className={styles.forms}>`. Where the two rules would
disagree, this sentence wins.

`isSubmitting` is what lets a successful save through. Every page in this
project navigates **inside** its `onSubmit` — see `CourseCreatePage` — so the
navigation that follows a save happens while `isSubmitting` is still true, and
the guard is off for exactly that window. React Hook Form leaves `isDirty` true
after a save, so a rule built on `isDirty` alone would block the redirect after
every successful create. Do not add a "saved" state of your own.

Where it goes:

- `CourseForm.tsx`, `LessonForm.tsx`, `TestForm.tsx`, `AdminUserForm.tsx`,
  `AssignmentForm.tsx` — one line each, exactly as above.
- `ProfileEditPage.tsx` has two forms on one page. One guard, placed once in the
  section, with `when` the OR of both: `(profileForm.formState.isDirty &&
  !profileForm.formState.isSubmitting) || (passwordForm.formState.isDirty &&
  !passwordForm.formState.isSubmitting)`.
- `TestAttemptForm.tsx` — the answers of a half-finished attempt are exactly the
  unsaved input 5.3 is about. This form does not use `formState.isSubmitting`;
  its condition is `answeredCount > 0 && !isSending`.

Where it does **not** go: `LoginPage` and `RegisterPage`. Nothing is lost by
leaving a sign-in form, and a guard there would fight the redirect that follows
a successful sign-in.

### 4. The two existing test files

`TestAttemptForm.test.tsx` renders through `MemoryRouter`, and `useBlocker`
throws outside a data router. Replace each of the three render sites with
`createMemoryRouter` + `RouterProvider`:

```tsx
const router = createMemoryRouter([{ path: "/", element: <TestAttemptForm test={test} onSubmit={onSubmit} /> }]);
render(<RouterProvider router={router} />);
```

Keep every assertion. Do not weaken a test to make it pass; if one fails for a
real reason, say so in the self-report rather than editing the expectation.

`ProtectedRoute.test.tsx` stays on `MemoryRouter` and is not touched: nothing in
it blocks.

### 5. The breakdown on screen

`client/src/features/learning/AttemptReview.tsx`:

```tsx
export type AttemptReviewProps = { review: AttemptReviewQuestion[] };
export function AttemptReview({ review }: AttemptReviewProps): ReactNode;
```

- Renders nothing at all when `review.length === 0`.
- A heading `<h3>Разбор ответов</h3>`, then an ordered list, one item per
  question in the order the array arrives — the server already sorted it.
- Each question shows its number and text, and a verdict: «Верно» or «Неверно».
- Each option is a row carrying its text plus **words**, not colour alone:
  «правильный ответ» when `isCorrect`, «ваш выбор» when `isSelected`. A row can
  carry both. Classes may add colour on top; the words stay either way, and this
  is the one accessibility rule you follow here, because a review session that
  finds the meaning encoded only in a colour will send it back.
- A question with no `isSelected` option shows «Вы не ответили».

`LearningTestPage.tsx`: render `<AttemptReview review={attempt.review} />` inside
the existing result section, after the «Попытка №…» / date lines and before the
«Пройти ещё раз» button. Nothing else on that page changes — no slice change, no
API change: `learningApi` already parses the response with `attemptResultSchema`
and `state.learning.attempt.data` already carries the new field typed.

## What this slice does not do

- No WCAG work. No contrast changes, no new focus styles, no audit.
- No `Pagination` change, no `objectIdSchema` lowering, no `ActionError`
  extraction. Those tails are listed in the plan against files this slice barely
  opens; leaving them is the decision, not an oversight.
- No screen for reviewing a **past** attempt. Specification 18.2 asks for the
  breakdown after submitting, and the response to the attempt is where it lives.

## Gate

From the repository root, in this order:

```
npm run build && npm run typecheck && npm run lint && npm run test
```

Do not open a browser. The checklist for the developer goes in the self-report.

## Self-report

`.codex/reports/slice-13-client.md`, in the format of `AGENTS.md` (8). Section 5
— «claim → check → result», one line per claim, including the ones that held —
is mandatory and must cover at least:

- every route that `App.tsx` served is served by `router.tsx`, same path, same
  element, same nesting (list them, or say which differ and why);
- a successful save navigates without the dialog, on at least one create page
  and one edit page;
- signing out of a dirty form does not raise the dialog;
- the breakdown shows the correct option for a question answered wrongly.

End with a manual checklist for the developer: what to click, what to expect.
Then stop. One commit, no push, no amend.
