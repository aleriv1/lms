# Slice 01 — repository skeleton and design system

Read `AGENTS.md` first. It outranks this prompt. This slice has no business
logic: it builds the ground every later slice stands on.

## Goal

After this slice: `npm install`, `npm run build`, `npm run typecheck`,
`npm run lint`, `npm run test` and `npm run dev` all succeed from the repository
root; the client opens in the browser; the server answers its health route and
is connected to MongoDB.

No domain entity, no authentication, no page from specification section 7.

## Given

- `shared/` is written, compiled and verified. **Do not modify anything under
  `shared/`**, including its `tsconfig.json`. Build it, import from it.
- Node 24 LTS, React 19, Express 5, MongoDB via Docker (specification 10).
- The developer has Node 24 active and Docker available. MongoDB runs as a
  container; if it is not reachable, report that — do not install a database.

## Decisions already made — implement, do not reconsider

- npm workspaces: `shared`, `server`, `client`. No pnpm, no yarn, no Turborepo,
  no Nx.
- Server TypeScript runs through `tsx` in development and is compiled with `tsc`
  for the build. No bundler on the server.
- ESLint 9 flat config, one `eslint.config.js` at the root covering all three
  workspaces. Prettier for formatting, with `eslint-config-prettier` so the two
  do not fight.
- Vitest as the test runner in both `server` and `client`.
- The client dev server proxies `/api` to the server, so the browser sees one
  origin in development. CORS is still configured on the server per
  specification 10.3.
- Redux Toolkit is **not** installed in this slice. A store with no reducers is
  not valid, and inventing a placeholder slice would be dead code. The store
  arrives in slice 02 together with `authSlice`.
- The router carries only the routes this slice can actually serve: `/` and the
  catch-all 404. Later slices add their own routes. Do not scaffold empty page
  components for specification section 6.

## Dependencies

Install the current stable release of each. The major version is stated because
the code below depends on it — **if `npm install` resolves a different major,
stop and report it instead of adapting the code.**

Root (dev): `typescript` 5, `eslint` 9, `typescript-eslint` 8, `prettier` 3,
`eslint-config-prettier` 10, `concurrently` 9.

`server`: `express` 5, `mongoose` 8, `cors` 2, `cookie-parser` 1, `dotenv` 17,
`@lms/shared` (workspace). Dev: `tsx` 4, `vitest` 3, `supertest` 7,
`@types/express`, `@types/cors`, `@types/cookie-parser`, `@types/supertest`,
`@types/node`.

`client`: `react` 19, `react-dom` 19, `react-router-dom` 7, `@lms/shared`
(workspace). Dev: `vite` 7, `@vitejs/plugin-react` 5, `vitest` 3, `jsdom` 26,
`@testing-library/react` 16, `@testing-library/jest-dom` 6, `eslint-plugin-react-hooks`,
`@types/react`, `@types/react-dom`.

Nothing else. Adding a dependency outside this list is the case AGENTS.md
section 2 tells you to stop and report.

## Files to create

Exactly these. Do not add files beyond this list; if one is missing for the
slice to work, say so in the self-report.

**Root**

```
package.json              workspaces + scripts below
.nvmrc                    24
tsconfig.base.json        strict options shared by client and server
eslint.config.js          flat config for all workspaces
.prettierrc.json
.prettierignore
.env.example              variable names with placeholder values, no secrets
```

`.gitignore` already exists and is correct. `shared/tsconfig.json` stays
standalone and is not refactored to extend the base config.

**Server**

```
server/package.json
server/tsconfig.json                    extends ../tsconfig.base.json
server/src/index.ts                     bootstrap: load env, connect, listen
server/src/app.ts                       express app assembly, exported for tests
server/src/config/env.ts                environment parsed and validated once
server/src/db/connect.ts                mongoose connection
server/src/errors/AppError.ts
server/src/middleware/requestLogger.ts
server/src/middleware/validate.ts
server/src/middleware/notFound.ts
server/src/middleware/errorHandler.ts
server/src/routes/index.ts              mounts the /api router
server/src/routes/health.ts
server/src/routes/health.test.ts
```

**Client**

```
client/package.json
client/index.html
client/vite.config.ts
client/tsconfig.json                    extends ../tsconfig.base.json
client/tsconfig.node.json               for vite.config.ts
client/src/main.tsx
client/src/App.tsx                      router
client/src/vite-env.d.ts
client/src/setupTests.ts
client/src/api/ApiError.ts
client/src/api/client.ts
client/src/styles/tokens.css            design tokens
client/src/styles/global.css            reset + base typography
client/src/pages/NotFoundPage.tsx
client/src/pages/NotFoundPage.module.css
client/src/components/ui/index.ts       re-exports the nine components
client/src/components/ui/Button/Button.tsx        + Button.module.css
client/src/components/ui/Input/Input.tsx          + Input.module.css
client/src/components/ui/Select/Select.tsx        + Select.module.css
client/src/components/ui/Textarea/Textarea.tsx    + Textarea.module.css
client/src/components/ui/Checkbox/Checkbox.tsx    + Checkbox.module.css
client/src/components/ui/Modal/Modal.tsx          + Modal.module.css
client/src/components/ui/Loader/Loader.tsx        + Loader.module.css
client/src/components/ui/EmptyState/EmptyState.tsx + EmptyState.module.css
client/src/components/ui/ErrorState/ErrorState.tsx + ErrorState.module.css
client/src/components/ui/Button/Button.test.tsx
client/src/components/ui/Modal/Modal.test.tsx
```

`Table` and `Pagination` are deliberately absent: their first consumer appears
in slice 03 and they would otherwise be guesswork.

## Root scripts

```json
{
  "build": "npm run build -w shared && npm run build -w server && npm run build -w client",
  "typecheck": "npm run typecheck -w shared && npm run typecheck -w server && npm run typecheck -w client",
  "lint": "eslint .",
  "format": "prettier --write .",
  "test": "npm run test -w server && npm run test -w client",
  "dev": "concurrently -n server,client \"npm run dev -w server\" \"npm run dev -w client\""
}
```

`npm run seed` is not part of this slice; it arrives in slice 02 with the first
data to write.

## Signatures

Implement these exactly. They are the surface later slices are written against.

**`server/src/config/env.ts`** — parse `process.env` once with a local Zod
schema (environment is not a wire contract, so it does not belong in `shared/`).
Fail fast with a readable message listing the missing variables.

```ts
export type Env = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  mongodbUri: string;
  clientOrigin: string;
};

export const env: Env;
```

`.env.example` documents exactly: `NODE_ENV`, `PORT`, `MONGODB_URI`,
`CLIENT_ORIGIN`. No JWT secret yet — it arrives in slice 02 with the session.

**`server/src/errors/AppError.ts`** — the one way handlers signal a failure.

```ts
import type { ApiErrorCode, FieldError } from "@lms/shared";

export class AppError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly fields?: FieldError[];
  constructor(status: number, code: ApiErrorCode, message: string, fields?: FieldError[]);
}
```

**`server/src/middleware/validate.ts`** — validation runs in middleware, before
the handler (AGENTS.md section 5).

```ts
import type { RequestHandler } from "express";
import type { ZodType } from "zod";

export type ValidationTarget = "body" | "query" | "params";

/**
 * Validates one part of the request against a schema from `@lms/shared` and
 * replaces it with the parsed value, so handlers receive normalised data.
 * On failure: 422, code "validation_error", one entry in `fields` per issue.
 */
export function validate(schema: ZodType, target?: ValidationTarget): RequestHandler;
```

Map each Zod issue to `{ field, message }` where `field` is the issue path
joined with `.` and `message` is the issue message — the Russian text already
written into the schemas. Do not translate or rewrite it.

**`server/src/middleware/errorHandler.ts`** — the single exit for every failure.
Express 5 forwards rejected promises from async handlers here on its own; do not
write a `catchAsync` wrapper.

- `AppError` → its own status, code, message and fields.
- Anything else → `500` with code `internal_error` and a fixed generic message.
  Log the real error on the server; never send its details to the client
  (specification 9.5).
- The response body always satisfies `apiErrorSchema`.

**`server/src/middleware/notFound.ts`** — unmatched `/api` path → `AppError(404,
"not_found", ...)` passed to `next`.

**`server/src/middleware/requestLogger.ts`** — one line per request: method,
path, status, duration in ms. Never log bodies, headers or cookies.

**`server/src/routes/health.ts`** — `GET /api/health` →
`200 { status: "ok", db: "connected" | "disconnected" }`, where `db` reflects
`mongoose.connection.readyState`. This is the only endpoint without a schema in
`shared/`: it is infrastructure, not part of the API contract. Say so in a
comment.

**`server/src/app.ts`** — assembles, in this order: `requestLogger`,
`cors` (origin `env.clientOrigin`, `credentials: true`), `express.json()`,
`cookieParser()`, the `/api` router, `notFound`, `errorHandler`. Exports the
app without listening, so tests can mount it.

**`server/src/index.ts`** — connects to MongoDB, then listens. If the connection
fails, log and exit non-zero; do not start a server that cannot serve.

**`client/src/api/ApiError.ts`**

```ts
import type { ApiErrorCode, FieldError } from "@lms/shared";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly fields?: FieldError[];
  constructor(status: number, code: ApiErrorCode, message: string, fields?: FieldError[]);
}
```

**`client/src/api/client.ts`** — the one place that talks to the server.

```ts
export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

/**
 * Sends a request to the API and returns the parsed JSON body.
 * Always sends cookies. On a non-2xx response, parses the body with
 * `apiErrorSchema` and throws `ApiError`; if the body is not a valid API error,
 * throws `ApiError` with code "internal_error".
 */
export async function apiRequest<TResponse>(path: string, options?: RequestOptions): Promise<TResponse>;
```

Base URL comes from `import.meta.env.VITE_API_URL`, default `/api`. Central
handling of `401` (redirect to login) is wired in slice 02, when there is a
session to lose — leave a place for it, not an empty function.

**Base components.** Nine components, CSS Modules only, every colour, spacing
and radius from a token in `tokens.css`. Each forwards the native props of the
element it wraps, so later slices are not blocked by a missing attribute.

```ts
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  isLoading?: boolean;   // disables the button and shows a spinner
};

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;         // a real <label>, never a placeholder substitute
  error?: string;        // rendered next to the field, linked by aria-describedby
  isRequired?: boolean;  // marked visually and with aria-required
};

// Select, Textarea, Checkbox: the same shape over their own element type.
// Select additionally takes options: { value: string; label: string }[].

type ModalProps = {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

type LoaderProps = { label?: string };

type EmptyStateProps = { title: string; description?: string; action?: React.ReactNode };

type ErrorStateProps = { title?: string; description?: string; onRetry?: () => void };
```

`Modal` requirements from specification 5.3: blocks interaction with the
background, closes on `Escape`, keeps focus inside while open, returns focus to
the trigger on close, and is rendered through a portal.

`tokens.css` defines custom properties for colour, spacing, radius, font size,
font weight and shadow. No hard-coded colour anywhere else in the client.

## Tests

Four, no more. They exist so `npm run test` is meaningful from day one, not to
cover this slice.

- `health.test.ts` — mounts the app with supertest, asserts `200` and the body
  shape; asserts an unknown `/api` path returns `404` with code `not_found` in
  the `apiErrorSchema` shape.
- `Button.test.tsx` — renders, click calls the handler, `isLoading` disables it.
- `Modal.test.tsx` — closed renders nothing; open renders the title; `Escape`
  calls `onClose`.

## Verification

Run all of these from the root, in this order, and report the result of each:

```
npm install
npm run build
npm run typecheck
npm run lint
npm run test
```

Then start MongoDB and the app and confirm the health route by hand:

```
docker run -d --name lms-mongo -p 27017:27017 -v lms-mongo-data:/data/db mongo:8
npm run dev
curl http://localhost:4000/api/health
```

Expected: `{"status":"ok","db":"connected"}`, and the client page loads in the
browser with the 404 page on an unknown path.

## Hand over

Write the self-report to `.codex/reports/slice-01.md` in the form of AGENTS.md
section 8, commit as section 8 describes, and stop. Do not start slice 02.

State explicitly in the report:

1. the resolved major version of every dependency listed above, and any that
   differed from what this prompt states;
2. any file you created that is not on the list, and why it was unavoidable;
3. whether MongoDB was reachable and the health route actually returned
   `db: "connected"`.
