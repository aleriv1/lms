# Slice 02 — authentication, roles, profile

Read `AGENTS.md` first. It outranks this prompt. The specification outranks both.

## Goal

A working session: register, log in, log out, and a profile the user can view and
edit. Role decides what the sidebar shows and which routes open. Blocking an
account kills its live session on the next protected request.

This is the slice that turns the skeleton into an application. Everything after
it assumes `request.user` on the server and `state.auth.user` on the client.

## Given

- `shared/` is written, compiled and verified. **Do not modify anything under
  `shared/`.** Every schema this slice needs already exists there:
  `registerBodySchema`, `loginBodySchema`, `sessionResponseSchema`,
  `publicUserSchema`, `updateProfileBodySchema`, `changePasswordBodySchema`,
  `apiErrorSchema`, `userRoleSchema`, `userStatusSchema`, `API_ERROR_CODES`.
  Import them. If one seems wrong, stop and report — do not edit it.
- Slice 01 is accepted. `AppError`, `validate`, `errorHandler`, `notFound`,
  `requestLogger`, `apiRequest`, `ApiError`, the nine UI primitives and the
  design tokens exist and are the surface you build on. Do not rewrite them.
- `Button` already defaults to `type="button"`. A submitting button must state
  `type="submit"` itself.
- `server/src/setupTests.ts` already gives server tests their environment. New
  server tests must not stub environment variables themselves.
- MongoDB runs as a container: `npm run db:up`. If Docker is unavailable, say so
  in the report — do not install or substitute a database.

## Decisions already made — implement, do not reconsider

- **Password hashing: `bcryptjs`.** Pure JavaScript, no native build step. Cost
  factor 10, declared once as a constant. Not `bcrypt`, not `argon2`.
- **Session: JWT in an `httpOnly` cookie**, `jsonwebtoken`. The payload carries
  **only** the user id (`sub`). Role and status are never read from the token —
  they are read from the database on every protected request (specification
  3.1, 10.3). This is the single most important line in this prompt.
- **`JWT_SECRET` joins the environment** in this slice: `server/src/config/env.ts`,
  `server/.env.example`, `server/src/setupTests.ts`. Minimum length 32.
- Cookie: name `session`, `httpOnly`, `sameSite: "lax"`, `secure` only when
  `NODE_ENV === "production"`, `path: "/"`, lifetime 7 days, matching the token
  expiry. A cross-site production deployment would need `sameSite: "none"`;
  that is a deployment decision and does not belong here.
- **Redux Toolkit arrives now**, together with `authSlice` — the store finally
  has a reducer. React Redux `Provider` wraps the app in `main.tsx`.
- **React Hook Form with the Zod resolver** over `shared/` schemas for all four
  forms. No hand-rolled validation, no second validation library.
- The session is loaded once at start-up: `main.tsx` dispatches the session
  thunk before rendering. `GET /auth/me` answering `401` is the normal
  anonymous case, not an error.
- **`request.user` is a `PublicUser`**, never a Mongoose document. A document in
  the request risks a `passwordHash` reaching a response by accident.
- `passwordHash` is declared `select: false` on the model. The two places that
  need it ask for it explicitly.
- Changing the password keeps the session. The token carries only `sub`, so it
  stays valid; there is nothing to rotate. Specification 7.9 permits this.
- Sidebar items are data, not components: one role-to-items table.

## Not in this slice — do not add it

- **Login rate limiting** (specification 10.3) — slice 13. Do not install
  `express-rate-limit`.
- **Profile statistics** — the cabinet block of specification 7.8 (time,
  completed lessons, course progress, four-week activity) needs learning data
  that does not exist yet. It arrives in slice 09. Render the identity block
  only; **do not render empty statistic widgets or zeroes.**
- **"Мои курсы"** in the teacher sidebar — specification 5.1 allows it as a
  filter of the course catalogue, and the catalogue's filter contract is written
  in slice 03. It arrives there.
- **"Мое обучение"** for teacher and admin — conditional on active assignments,
  which arrive in slice 06. In this slice the item belongs to `student` only.
- **The unsaved-changes warning** of specification 5.3. It needs the data router
  (`createBrowserRouter` + `useBlocker`), and migrating the router is a change
  that should happen once, for all forms at once, not inside this slice. Keep
  `<BrowserRouter>`. Do not build a substitute with `beforeunload`.
- **Route-level tests that need a database.** How tests get a database is
  decided in slice 11. Write only the tests listed under "Tests" below.
- Admin user management, course routes, learning routes. Other slices.

## Expected intermediate state — this is not a defect

`getStartPath` returns the paths specification 7.1 requires: `student` →
`/learning`, `teacher` → `/manage/courses`, `admin` → `/admin`. **None of those
routes exist yet** — they arrive in slices 07, 03 and 09. Until then a logged-in
user landing there sees the 404 page, with the sidebar next to it. That is
correct and intended: a route is added by the slice that serves it, and no
placeholder pages are created.

Because of that, the 404 and 403 pages must not send the user to a path that
does not exist yet. Both link to `/profile` for an authenticated user and to
`/login` for an anonymous one. `/profile` exists from this slice onwards.

## Dependencies

Install the current stable release of each. The major is stated because the code
below depends on it — **if `npm install` resolves a different major, stop and
report it instead of adapting the code.**

`server`: `bcryptjs` 3, `jsonwebtoken` 9. Dev: `@types/jsonwebtoken` 9.

> `bcryptjs` 3 ships its own type declarations. **Do not add `@types/bcryptjs`** —
> it is a stub package and would shadow them.

`client`: `@reduxjs/toolkit` 2, `react-redux` 9, `react-hook-form` 7,
`@hookform/resolvers` 5.

Nothing else. Anything beyond this list is the case AGENTS.md section 2 tells
you to stop and report.

## Files

Create:

```
server/src/models/User.ts
server/src/auth/password.ts
server/src/auth/session.ts
server/src/auth/session.test.ts
server/src/middleware/requireAuth.ts
server/src/middleware/requireRole.ts
server/src/middleware/requireRole.test.ts
server/src/types/express.d.ts
server/src/routes/auth.ts
server/src/routes/users.ts
server/src/scripts/seed.ts

client/src/store/index.ts
client/src/store/hooks.ts
client/src/api/formError.ts
client/src/features/auth/authApi.ts
client/src/features/auth/authSlice.ts
client/src/routes/startPath.ts
client/src/routes/ProtectedRoute.tsx
client/src/components/layout/navItems.ts
client/src/components/layout/AppLayout.tsx
client/src/components/layout/AppLayout.module.css
client/src/pages/AuthForm.module.css
client/src/pages/LoginPage.tsx
client/src/pages/RegisterPage.tsx
client/src/pages/ForbiddenPage.tsx
client/src/pages/ForbiddenPage.module.css
client/src/pages/ProfilePage.tsx
client/src/pages/ProfilePage.module.css
client/src/pages/ProfileEditPage.tsx
client/src/pages/ProfileEditPage.module.css
```

Modify:

```
server/src/config/env.ts            JWT_SECRET; z.string().url() -> z.url()
server/src/setupTests.ts            JWT_SECRET
server/.env.example                 JWT_SECRET placeholder
server/src/routes/index.ts          mount the two routers
server/package.json                 dependencies, seed script
client/src/api/client.ts            central 401 handling
client/src/App.tsx                  real routes, HomePage removed
client/src/main.tsx                 Provider, session bootstrap
client/src/pages/NotFoundPage.tsx   link target per session state
client/package.json                 dependencies
package.json                        seed script
```

Anything else you find yourself editing means you have misread this prompt.
`client/src/components/ui/**` in particular is finished; if a primitive does not
fit, report it instead of editing it.

## Server signatures

**`server/src/config/env.ts`** — extend the existing schema and type:

```ts
JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
```

`Env` gains `jwtSecret: string`. While in this file, replace the deprecated
`z.string().url()` on `CLIENT_ORIGIN` with `z.url()` — zod 4 is already the
installed version.

`server/.env.example` gains `JWT_SECRET=` with an obvious placeholder value, and
`server/src/setupTests.ts` gains a matching `process.env.JWT_SECRET ??= ...`
line in the same `??=` style as its neighbours.

**`server/src/models/User.ts`** — the model plus the only mapper that turns a
document into a wire value.

```ts
import type { PublicUser, UserRole, UserStatus } from "@lms/shared";
import { type HydratedDocument, model, Schema } from "mongoose";

export type UserAttributes = {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  groupName: string | null;
  status: UserStatus;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UserDocument = HydratedDocument<UserAttributes>;

export const User = model<UserAttributes>("User", userSchema);

/** The only way a user leaves the server. */
export function toPublicUser(user: UserDocument): PublicUser;
```

Schema rules: `email` is `unique`, `lowercase`, `trim`, `required`;
`passwordHash` is `required` and **`select: false`**; `role` defaults to
`"student"`; `status` defaults to `"active"`; `groupName` defaults to `null`;
`lastLoginAt` defaults to `null`; `timestamps: true`. `toPublicUser` returns
exactly the fields of `publicUserSchema`, with `_id` as a string and the dates
as ISO strings.

**`server/src/auth/password.ts`**

```ts
export const PASSWORD_SALT_ROUNDS = 10;
export function hashPassword(password: string): Promise<string>;
export function verifyPassword(password: string, passwordHash: string): Promise<boolean>;
```

**`server/src/auth/session.ts`** — token and cookie in one place.

```ts
import type { Response } from "express";

export const SESSION_COOKIE_NAME = "session";
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** The payload carries the user id and nothing else. */
export function signSessionToken(userId: string): string;

/** Returns the user id, or null for a missing, malformed, expired or forged token. */
export function verifySessionToken(token: string): string | null;

export function setSessionCookie(response: Response, token: string): void;
export function clearSessionCookie(response: Response): void;
```

`verifySessionToken` never throws — it returns `null`. `clearSessionCookie` must
pass the same `httpOnly`, `sameSite`, `secure` and `path` options as
`setSessionCookie`, or the browser keeps the old cookie.

**`server/src/types/express.d.ts`**

```ts
import type { PublicUser } from "@lms/shared";

declare global {
  namespace Express {
    interface Request {
      user?: PublicUser;
    }
  }
}

export {};
```

**`server/src/middleware/requireAuth.ts`**

```ts
import type { Request, RequestHandler } from "express";
import type { PublicUser } from "@lms/shared";

export const requireAuth: RequestHandler;

/**
 * Reads the user `requireAuth` attached. Throws 401 instead of a non-null
 * assertion, so a handler mounted without `requireAuth` fails loudly.
 */
export function getAuthenticatedUser(request: Request): PublicUser;
```

`requireAuth` in order: read the cookie — missing → `401 unauthorized`; verify
it — invalid → clear the cookie, `401 unauthorized`; load the user by id — gone
→ clear the cookie, `401 unauthorized`; check `status === "active"` — otherwise
clear the cookie and `401 account_blocked`. Only then attach
`request.user = toPublicUser(user)`. **The database read is not optional and not
cacheable: it is what makes blocking immediate (specification 3.1).**

**`server/src/middleware/requireRole.ts`**

```ts
import type { UserRole } from "@lms/shared";
import type { RequestHandler } from "express";

export function requireRole(...roles: UserRole[]): RequestHandler;
```

No `request.user` → `401 unauthorized`. Role not listed → `403 forbidden`. It is
always mounted after `requireAuth`, never instead of it.

## Server routes

Mount in `server/src/routes/index.ts`: `apiRouter.use("/auth", authRouter)` and
`apiRouter.use("/users", usersRouter)`.

Every mutating route validates in middleware with `validate(schema)` before the
handler, per AGENTS.md section 5.

**`POST /api/auth/register`** — `registerBodySchema`. Email already used →
`409 email_taken`, with `fields: [{ field: "email", message: "Email уже занят" }]`
so the client can put it under the field. Otherwise create the user with role
`student` and status `active`, set the cookie, respond **`201`** with
`sessionResponseSchema`.

**`POST /api/auth/login`** — `loginBodySchema`. In this order:

1. find the user with `passwordHash` explicitly selected;
2. no user, or the password does not match → `401 invalid_credentials`,
   message `"Неверный email или пароль"` — the same answer for both, so the
   response never reveals whether an account exists (specification 7.1);
3. only then look at status: `blocked` → `403 account_blocked` with a message
   that says the account is blocked; `archived` → `401 invalid_credentials`,
   the same opaque answer as an unknown email;
4. set `lastLoginAt`, save, set the cookie, respond `200` with
   `sessionResponseSchema`.

Checking the password before the status is deliberate: a wrong password must
never earn the "blocked" message.

**`POST /api/auth/logout`** — clears the cookie and responds `204`. No
`requireAuth`: logging out without a valid session is not an error.

**`GET /api/auth/me`** — `requireAuth`, responds `200` with
`sessionResponseSchema`.

**`PATCH /api/users/me`** — `requireAuth`, `updateProfileBodySchema`. If the
email changed and belongs to another user → `409 email_taken` with the same
`fields` entry. Responds `200` with `sessionResponseSchema`. Role, status and
`groupName` are not editable here (specification 4.1) — the schema does not
carry them, and the handler must not read them from the body.

**`PATCH /api/users/me/password`** — `requireAuth`, `changePasswordBodySchema`.
Re-read the user with `passwordHash` selected; `currentPassword` does not match
→ `422 invalid_current_password`. Otherwise store the new hash and respond
`204`. Do not touch the cookie.

**`server/src/scripts/seed.ts`** — run by `npm run seed`. Connects with the
existing `connectToDatabase`, creates exactly three users if they are absent,
and closes the connection. Re-running it must not duplicate anything and must
not delete anything: match by email and skip what exists.

```
admin@lms.local     Администратор Системы   admin     Password1
teacher@lms.local   Преподаватель Иванов    teacher   Password1
student@lms.local   Обучающийся Петров      student   Password1
```

Passwords are hashed through `hashPassword`, never written as literals into the
database. Print a one-line summary per user (created or already present). The
full demo dataset of specification 12 belongs to slice 10.

Scripts: `"seed": "tsx src/scripts/seed.ts"` in `server/package.json`, and
`"seed": "npm run seed -w server"` in the root `package.json`.

## Client signatures

**`client/src/api/client.ts`** — add central 401 handling at the boundary the
existing comment marks, and delete that comment.

```ts
export function setUnauthorizedHandler(handler: () => void): void;
```

One module-level handler, registered once by the store. On a `401` the handler
runs **except** for `/auth/login`, `/auth/register` and `/auth/me`: a failed
login and the anonymous session probe are not expired sessions. The error is
still thrown afterwards — the handler does not swallow it.

**`client/src/api/formError.ts`** — the shape a rejected thunk may carry.
`ApiError` is a class instance and must not enter the store.

```ts
import type { ApiErrorCode, FieldError } from "@lms/shared";

export type FormError = {
  code: ApiErrorCode;
  message: string;
  fields?: FieldError[];
};

export function toFormError(error: unknown): FormError;
```

`toFormError` maps an `ApiError` field by field and turns anything else into
`{ code: "internal_error", message: "Произошла внутренняя ошибка" }`.

**`client/src/features/auth/authApi.ts`** — thin `apiRequest` wrappers, one per
route, typed by the `shared/` schemas. No logic.

```ts
export function requestSession(): Promise<SessionResponse>;
export function requestLogin(body: LoginBody): Promise<SessionResponse>;
export function requestRegister(body: RegisterBody): Promise<SessionResponse>;
export function requestLogout(): Promise<void>;
export function requestProfileUpdate(body: UpdateProfileBody): Promise<SessionResponse>;
export function requestPasswordChange(body: ChangePasswordBody): Promise<void>;
```

**`client/src/features/auth/authSlice.ts`**

```ts
export type AuthStatus = "idle" | "loading" | "authenticated" | "anonymous" | "error";

export type AuthState = {
  user: PublicUser | null;
  status: AuthStatus;
};

export const sessionExpired: ActionCreator;   // reducer: user = null, status = "anonymous"

export const fetchSession: AsyncThunk;        // GET /auth/me
export const login: AsyncThunk;
export const register: AsyncThunk;
export const logout: AsyncThunk;
export const updateProfile: AsyncThunk;
export const changePassword: AsyncThunk;
```

- `fetchSession` treats `401` as the anonymous case: it resolves with `null` and
  the reducer sets `status: "anonymous"`. Any other failure sets
  `status: "error"`, so the shell can offer a retry (specification 5.2).
- The other thunks reject with `rejectWithValue(toFormError(error))`. Their
  components read that value; the slice does not store form errors.
- `login`, `register` and `updateProfile` fulfil with the user and set
  `status: "authenticated"`. `logout` clears the user regardless of whether the
  request succeeded — a failed logout must not strand the user in a session the
  server has already dropped.
- `changePassword` changes no state on success.

**`client/src/store/index.ts`** — `configureStore` with the auth reducer,
`RootState` and `AppDispatch` types, and the one-line registration
`setUnauthorizedHandler(() => store.dispatch(sessionExpired()))`.

**`client/src/store/hooks.ts`** — the standard typed `useAppDispatch` and
`useAppSelector`. Nothing else.

**`client/src/routes/startPath.ts`**

```ts
import type { UserRole } from "@lms/shared";

/** Specification 7.1. See "Expected intermediate state" in the slice prompt. */
export function getStartPath(role: UserRole): string;
```

**`client/src/routes/ProtectedRoute.tsx`**

```ts
export type ProtectedRouteProps = {
  roles?: UserRole[];
};
```

Renders, by `state.auth.status`: `idle`/`loading` → `<Loader />`; `error` →
`<ErrorState />` with a retry that dispatches `fetchSession`; `anonymous` →
`<Navigate to="/login" state={{ from: location }} replace />`; authenticated
with `roles` given and the role absent → `<Navigate to="/forbidden" replace />`;
otherwise `<Outlet />`.

**`client/src/components/layout/navItems.ts`**

```ts
export type NavItem = { to: string; label: string };
export function getNavItems(role: UserRole): NavItem[];
```

- `student`: «Мое обучение» → `/learning`, «Личный кабинет» → `/profile`
- `teacher`: «Каталог курсов» → `/manage/courses`, «Личный кабинет» → `/profile`
- `admin`: «Главная» → `/admin`, «Каталог курсов» → `/manage/courses`,
  «Пользователи» → `/admin/users`, «Личный кабинет» → `/profile`

«Выйти» is an action, not a navigation item: the layout renders it as a
`Button`, outside this table.

**`client/src/components/layout/AppLayout.tsx`** — sidebar plus content area
(specification 5.1). Items come from `getNavItems`; the active one is marked
with `NavLink` and its `isActive` state, not by comparing strings by hand. The
user's name and role are shown in the sidebar. Renders `<Outlet />`.

## Client routes

`App.tsx` keeps `<BrowserRouter>` and declares:

```
/                     RootRedirect: authenticated -> getStartPath(role), else /login
/login                LoginPage        (authenticated -> getStartPath(role))
/register             RegisterPage     (authenticated -> getStartPath(role))
/forbidden            ForbiddenPage
  ProtectedRoute (no roles) + AppLayout
    /profile          ProfilePage
    /profile/edit     ProfileEditPage
*                     NotFoundPage
```

Delete the placeholder `HomePage` — `/` now redirects.

`main.tsx` wraps `<App />` in `<Provider store={store}>` and dispatches
`fetchSession()` once before `createRoot(...).render(...)`, so the bootstrap does
not double-fire under `StrictMode`.

After a successful login, navigate to `location.state.from` when it is present,
otherwise to `getStartPath(user.role)`. If the role does not permit `from`,
`ProtectedRoute` sends the user to `/forbidden` — that is exactly what
specification 3.1 asks for, so do not re-check it in the page.

After a successful registration, navigate to `getStartPath` of the returned
user's role.

## Pages

All four forms use React Hook Form with `zodResolver` over the `shared/` schema
named in the route section. Every form: labels through the existing `Input`
primitive, a general error area for the server's message, field errors from
`FormError.fields` applied with RHF `setError`, and a submit button that is
disabled while `formState.isSubmitting` — double submission is a defect
(specification 5.2, 5.3).

- **`LoginPage`** — email, password, «Войти», link to `/register`, error area.
  The server's message is displayed as it arrives; the page must not compose its
  own text for `invalid_credentials` or `account_blocked`.
- **`RegisterPage`** — name, email, password, password confirmation,
  «Зарегистрироваться», link to `/login`, error area.
- **`ForbiddenPage`** — `403`, an explanation, and both actions specification
  7.3 asks for: «Вернуться» to `/profile` (authenticated) or `/login`
  (anonymous), and «Войти под другой учетной записью», which dispatches `logout`
  and goes to `/login`.
- **`ProfilePage`** — name, email, role and group as a plain identity block,
  plus a link to `/profile/edit`. Role is shown in Russian. No statistics — see
  "Not in this slice".
- **`ProfileEditPage`** — two independent forms on one page: profile
  (`updateProfileBodySchema` → `updateProfile`) and password
  (`changePasswordBodySchema` → `changePassword`). Each has its own submit
  button, its own in-flight state and its own success confirmation
  (specification 5.2). A failure in one must not clear the other.

`NotFoundPage` keeps its text and gains the session-aware link described in
"Expected intermediate state".

Styling: CSS Modules and the existing tokens in `client/src/styles/tokens.css`.
No new colour literals, no UI kit, no inline one-off styles.

## Tests

Two files, both free of any database and any environment stubbing:

**`server/src/auth/session.test.ts`** — `signSessionToken` then
`verifySessionToken` returns the same id; a tampered token returns `null`; a
token signed with a different secret returns `null`.

**`server/src/middleware/requireRole.test.ts`** — with a plain object request
carrying a `PublicUser`: a listed role calls `next()` with no argument; an
unlisted role calls `next` with an `AppError` of status `403` and code
`forbidden`; no `request.user` gives status `401` and code `unauthorized`.

Route-level tests wait for slice 11, which decides how tests get a database. Do
not add `mongodb-memory-server`, and do not weaken these two into snapshots.

## Verification

From the repository root, and report the result of each:

```
npm install
npm run build
npm run typecheck
npm run lint
npm run test
```

Then, with Docker running and `server/.env` containing a `JWT_SECRET` of at
least 32 characters:

```
npm run db:up
npm run seed
npm run dev
```

Check by hand, with a cookie jar, and report what each returned:

1. `POST /api/auth/login` with `student@lms.local` / `Password1` → `200`, the
   user in the body, a `session` cookie marked `HttpOnly` in the response.
2. `GET /api/auth/me` with that cookie → `200`; without it → `401`
   `unauthorized`.
3. `POST /api/auth/login` with a wrong password → `401` `invalid_credentials`
   and the message `"Неверный email или пароль"`.
4. Set that user's `status` to `"blocked"` directly in MongoDB, then repeat
   step 2 with the same cookie → `401` `account_blocked`. **Set it back to
   `"active"` afterwards.** This is the acceptance check for specification 3.1;
   report the exact response you saw.
5. `PATCH /api/users/me/password` with a wrong `currentPassword` → `422`
   `invalid_current_password`.
6. In the browser: log in as the student, see the sidebar, open `/profile`,
   edit the name and see it change without a re-login, then open `/admin`
   directly and land on the 404 page (expected — see above).
7. Confirm no response body anywhere in the flow contains `passwordHash`.

Then stop every process you started — AGENTS.md section 8. Leave the container
running.

## Hand over

Write the self-report to `.codex/reports/slice-02.md` in the form of AGENTS.md
section 8, make exactly one commit, and stop.

State explicitly in the report:

1. the result of verification step 4, quoted;
2. every place where you needed a value the `shared/` schemas did not provide;
3. any file you touched that is not on the list above, and why;
4. anything you had to decide that this prompt left open — those are prompt
   defects and are wanted in the report even when your choice was obvious.
