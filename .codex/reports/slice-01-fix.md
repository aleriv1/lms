# Slice 01 fix self-report

## Completed

- Moved the environment example from the repository root to `server/.env.example` without changing its four variables or values.
- Replaced the five `latest` dependency specifiers with the requested caret ranges and regenerated `package-lock.json`.
- Added the shared Vitest environment setup and simplified the health test to use a static app import without changing its assertions.
- Added the MongoDB Compose service and the manual `db:up` and `db:down` scripts.
- Made `Button` default to `type="button"` and ordered its spread props before computed element attributes.
- Replaced the hand-written ESLint globals with workspace-scoped browser and Node globals from the authorized `globals` dependency.
- Verification from the repository root:
  - `npm install` — passed; one package added, one package changed, 419 packages audited, 0 vulnerabilities.
  - `npm run build` — passed.
  - `npm run typecheck` — passed.
  - `npm run lint` — passed.
  - `npm run test` — passed; 4 tests in 3 files.

## Required confirmations

- All five pinned ranges resolved to the same exact versions as before: `@types/cookie-parser` 1.4.10, `@types/cors` 2.8.19, `@types/express` 5.0.6, `@types/supertest` 7.2.1, and `eslint-plugin-react-hooks` 7.1.1.
- `npm run db:up` worked. Compose warned that the explicitly named `lms-mongo-data` volume already existed outside Compose, then started `lms-mongo` successfully. With the root dev processes running, `GET http://localhost:4000/api/health` returned `{"status":"ok","db":"connected"}`. The dev processes were stopped afterward; the MongoDB container was left running.
- `npm run lint` reported no undefined globals after the globals configuration change.
- No implementation file outside the prompt's file list was touched. This self-report is the only additional file and is required by the handover instructions.

## Departures and blocked work

- No departures from the prompt.
- No blocked work.

## Out-of-scope observations

- No additional out-of-scope defects were found.
