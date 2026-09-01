# Slice 02 fix — one destination after a successful login

Read `AGENTS.md` first. It outranks this prompt. The specification outranks both.

Slice 02 is accepted except for the defect below. This is a small, contained
change: two files, one behaviour. Do not revisit anything else in the slice.

## The defect

`LoginPage` decides where to go after a successful login in two places at once:

- the render-time guard, `client/src/pages/LoginPage.tsx:37` — when
  `status === "authenticated"`, it returns
  `<Navigate to={getStartPath(user.role)} replace />`;
- the submit handler, `client/src/pages/LoginPage.tsx:47` — it calls
  `navigate(state?.from ?? getStartPath(result.payload.role))`.

After a successful login both run. The guard does not know about
`location.state.from`, so which destination wins depends on the order in which a
store update, a passive effect and an awaited continuation happen to be flushed.

That matters in exactly the case `from` exists for: an anonymous visitor opens
`/profile/edit`, `ProtectedRoute` sends them to `/login` with
`state={{ from: location }}`, they sign in — and they can land on
`getStartPath(role)` instead of the page they asked for.

The prompt of slice 02 caused this: it asked for the authenticated guard on
`/login` and for the `from` navigation without saying how the two compose. Your
implementation followed it. The fix is to leave one mechanism.

## The change

Keep the declarative one, delete the imperative one.

**`client/src/pages/LoginPage.tsx`**

1. The authenticated guard becomes the only place that names a destination. It
   reads `from` from the location state and falls back to the role's start path:

```tsx
if (status === "authenticated" && user) {
  const from = (location.state as { from?: Location } | null)?.from;
  return <Navigate to={from ?? getStartPath(user.role)} replace />;
}
```

2. The submit handler no longer navigates. On
   `login.fulfilled.match(result)` it simply returns: the fulfilled thunk sets
   `status` to `"authenticated"`, the component re-renders, and the guard above
   redirects. The failure branch — `setServerError` and the `setError` loop over
   `formError.fields` — stays exactly as it is.

3. Remove what that leaves unused: the `useNavigate` import and the `navigate`
   constant. Keep `useLocation`, keep the `Location` type import, keep the
   `Loader` guard on `status === "idle" || status === "loading"` **including its
   `&& !isSubmitting`** — `login.pending` sets the global status to `"loading"`,
   and without that condition the form is replaced by a spinner mid-submit.

**`client/src/pages/RegisterPage.tsx`**

The same duplication, without the `from` case. Delete the `navigate(...)` call
from the submit handler and the now-unused `useNavigate` import and `navigate`
constant. The existing guard already sends the new user to
`getStartPath(user.role)`; registration has no `from` to honour, so the guard
stays as it is.

## Do not change anything else

In particular, leave these alone — they are accepted as they are:

- the route structure in `client/src/App.tsx`, including the two catch-all
  routes conditional on `isAuthenticated` and the `PublicNotFoundPage` wrapper.
  A signed-in user must keep seeing the 404 page inside the sidebar shell;
- `ProtectedRoute` and the `state={{ from: location }}` it sends;
- `authSlice`, the API client, every server file, and `shared/`.

No new dependencies. No new files.

## Verification

From the repository root:

```
npm run build
npm run typecheck
npm run lint
npm run test
```

Then, with the container up and the server seeded, in the browser — this is the
acceptance check for the defect, so report what you actually saw:

1. Signed out, open `/profile/edit` directly. You are sent to `/login`.
2. Sign in as `student@lms.local` / `Password1`. **You must land on
   `/profile/edit`**, not on `/learning`.
3. Open `/login` directly with no redirect behind it and sign in. You land on
   `/learning` — the 404 page inside the sidebar shell, which is the expected
   intermediate state of slice 02.
4. Register a new account from `/register`. You land on `/learning`, same shell.
5. Sign in with a wrong password. The form stays on screen, the server's message
   is shown, and the page does not flash a spinner in place of the form.

Stop every process you started — AGENTS.md section 8. Leave the container
running.

## Hand over

Write the self-report to `.codex/reports/slice-02-fix.md` in the form of
AGENTS.md section 8, make exactly one commit, and stop.
