# Slice 01 fix — environment, pinned ranges, database compose, lint globals

Read `AGENTS.md` first. It outranks this prompt.

This is not a new slice. Slice 01 was reviewed and is accepted except for the
six items below. Change only what is listed here. Do not refactor anything you
pass on the way, do not rename exports, do not touch `shared/`, and do not start
slice 02.

## Context you need

The review confirmed: `typecheck`, `lint`, `build` and `test` all pass, the file
list matches the slice 01 prompt, and the health route returns
`{"status":"ok","db":"connected"}` against a running MongoDB. The items below
are the whole remaining gap.

One review finding was withdrawn and must **not** be "fixed": `notFound` is
mounted for every path rather than only under `/api`. That is correct. The
server is API-only — the client is built by Vite and served separately, and the
specification never asks the server to serve static files. Leave
`server/src/app.ts` alone.

## 1. Move `.env.example` into `server/`

`server/src/index.ts` uses `import "dotenv/config"`, which reads `.env`
relative to the process working directory. `npm run dev -w server` runs with
`cwd = server/`, so a root `.env` is never loaded and the server dies on
`MONGODB_URI: expected string, received undefined`. The example file must sit
where the file it documents is actually read.

- Delete `.env.example` from the repository root.
- Create `server/.env.example` with the same four variables and values it has
  now: `NODE_ENV`, `PORT`, `MONGODB_URI`, `CLIENT_ORIGIN`. No new variables —
  `JWT_SECRET` belongs to slice 02.

Do not add an explicit path to `dotenv.config()`, do not add a second dotenv
call, and do not change how `env.ts` reads `process.env`. Moving the file is the
whole fix.

`.gitignore` already ignores `.env` at any depth, so `server/.env` is covered.
Do not edit `.gitignore`.

## 2. Replace the `latest` dependency specifiers with pinned ranges

`latest` is a dist-tag, not a range. It is recorded verbatim in the manifest, so
an install without the lockfile can resolve any major — exactly what the slice
01 prompt forbade. Use the caret range of the major that is already installed
and reported.

In `server/package.json` (`devDependencies`):

```
"@types/cookie-parser": "^1.4.0",
"@types/cors": "^2.8.0",
"@types/express": "^5.0.0",
"@types/supertest": "^7.2.0",
```

In `client/package.json` (`devDependencies`):

```
"eslint-plugin-react-hooks": "^7.1.0",
```

Run `npm install` afterwards so the lockfile records the new specifiers. The
resolved versions must not change; if any of them does, stop and report it
instead of accepting the new version.

## 3. Give the server tests their environment once

`server/src/config/env.ts` validates `process.env` when the module is first
imported. `server/src/routes/health.test.ts` works around this with `vi.stubEnv`
plus a dynamic `await import("../app.js")`. That ritual would repeat in every
server test file from slice 02 on, and a file that forgets it fails in a way
that reads as a bug in the code under test. Move it into one setup file.

Create `server/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./src/setupTests.ts"],
  },
});
```

Create `server/src/setupTests.ts` — it runs before the test module is imported,
so the environment is valid by the time `env.ts` is evaluated. Assign only what
is missing, so a real `server/.env.test` could override it later:

```ts
process.env.NODE_ENV ??= "test";
process.env.PORT ??= "4000";
process.env.MONGODB_URI ??= "mongodb://localhost:27017/corporate-learning-test";
process.env.CLIENT_ORIGIN ??= "http://localhost:5173";
```

Then simplify `server/src/routes/health.test.ts`: drop `beforeAll`, drop every
`vi.stubEnv` call, drop the `let app` declaration and the dynamic import, and
import the app statically at the top of the file:

```ts
import { app } from "../app.js";
```

The two existing assertions stay exactly as they are, including
`db: "disconnected"`. Do not add tests.

`server/src/setupTests.ts` is compiled into `dist/` along with the test file, as
today. Do not add an exclude to `server/tsconfig.json` to prevent it — build
layout is out of scope for this fix.

## 4. Describe the database as part of the project

MongoDB currently exists only as a `docker run` command in a handover note. It
is infrastructure the project needs in order to run, and acceptance criterion
14.1 is about the project starting from a clean checkout.

Create `docker-compose.yml` at the repository root:

```yaml
services:
  mongo:
    image: mongo:8
    container_name: lms-mongo
    restart: unless-stopped
    ports:
      - "27017:27017"
    volumes:
      - lms-mongo-data:/data/db

volumes:
  lms-mongo-data:
    name: lms-mongo-data
```

Both names are deliberate and must be kept verbatim: a container named
`lms-mongo` and a volume named `lms-mongo-data` already exist on the developer's
machine from the original `docker run`, and the explicit `name:` keeps Compose
on that same volume instead of creating a project-prefixed copy.

Add two root scripts to `package.json`:

```json
"db:up": "docker compose up -d",
"db:down": "docker compose down"
```

`db:down` must stop the container without removing the volume — no `-v`, no
`--volumes`. Do not wire either script into `dev`, `test` or any other script:
a dev server that silently starts Docker fails incomprehensibly when the engine
is off. They are run by hand.

If the Docker engine is unavailable on your machine, say so in the report and
leave the files as written — do not install or substitute a database, and do not
adjust the compose file to work around it.

## 5. Make `Button` default to `type="button"`

`client/src/components/ui/Button/Button.tsx` never sets `type`, so the rendered
element falls back to the HTML default `type="submit"`. From slice 02 on this
component sits inside forms, where every "Отмена", "Закрыть" or "Добавить
вопрос" button would submit the form it stands in. That failure is silent: the
button looks like it works and the form goes off early.

Add `type` to the destructured props with `"button"` as the default, and pass it
to the element. A submitting button then states `type="submit"` explicitly,
which is what a reader should have to see:

```tsx
export function Button({
  variant = "primary",
  isLoading = false,
  type = "button",
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
```

While you are in that file, move `{...props}` to the front of the element's
attributes, ahead of `className`, `disabled`, `aria-busy` and `type`, so the
component's own computed values win over a caller's stray attribute — the order
the other eight components already use. Do not change anything else about the
component, and do not touch `Button.test.tsx`: it must keep passing unchanged.

## 6. Let ESLint know the real globals

`eslint.config.js` declares globals by hand — `console`, `document`, `fetch`,
`window`, `process`, `NodeJS` and a few DOM classes — in one block that applies
to all three workspaces. Two consequences, both of which get worse every slice:
each new global (`localStorage`, `URL`, `Buffer`, `FormData`) turns into a
`no-undef` failure that is fixed by editing this file again, and server code
sees `window` and `document` as defined, so that typo is never caught.

Add `globals` to the **root** `devDependencies` at `^16.0.0`. This is the one
dependency added outside the slice 01 list; it is authorised here, and it is the
only one.

Then replace the hand-written `languageOptions` block with two scoped ones:

```js
import globals from "globals";

// ...

  {
    files: ["client/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["server/**/*.ts", "shared/**/*.ts", "*.js"],
    languageOptions: { globals: globals.node },
  },
```

Keep the existing `ignores` block, the `react-hooks` block scoped to `client/**`
and `eslintConfigPrettier` last, exactly as they are. If `npm run lint` then
reports a genuinely undefined global, name it in the report rather than adding
it back by hand.

## Files touched

Exactly these:

```
.env.example                      deleted
server/.env.example               created
server/package.json               four devDependency ranges
client/package.json               one devDependency range
package.json                      two scripts, globals devDependency
package-lock.json                 regenerated by npm install
server/vitest.config.ts           created
server/src/setupTests.ts          created
server/src/routes/health.test.ts  simplified
docker-compose.yml                created
eslint.config.js                  globals rewritten, scoped per workspace
client/src/components/ui/Button/Button.tsx   type default, prop order
```

Anything else you find yourself editing means you have misread this prompt.

## Verification

From the repository root, and report the result of each:

```
npm install
npm run build
npm run typecheck
npm run lint
npm run test
```

Then, with the Docker engine running:

```
npm run db:up
cp server/.env.example server/.env   # if you do not already have one
npm run dev
curl http://localhost:4000/api/health
```

Expected: `{"status":"ok","db":"connected"}`. Then stop the dev servers you
started — AGENTS.md section 8. Leave the container running.

## Hand over

Write the self-report to `.codex/reports/slice-01-fix.md` in the form of
AGENTS.md section 8, make exactly one commit, and stop.

State explicitly in the report:

1. whether the five pinned ranges resolved to the same versions as before;
2. whether `npm run db:up` worked and the health route actually returned
   `db: "connected"`;
3. any global that `npm run lint` reported as undefined after item 6;
4. any file you touched that is not on the list above, and why.
