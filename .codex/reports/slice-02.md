# Slice 02 self-report

## Completed

- Added the `User` model and the only document-to-`PublicUser` mapper. Email is normalized and unique, `passwordHash` is excluded by default, and role/status/timestamp defaults match the slice.
- Added bcryptjs password hashing with one cost-factor constant, JWT session signing/verification, and matching seven-day secure cookie set/clear behavior. The JWT is signed with `sub` only; protected requests always reload role and status from MongoDB.
- Added authentication and profile routes for registration, login, logout, session lookup, profile update, and password change. All request bodies use the `shared/` schemas, duplicate email races are handled, and no response mapper exposes `passwordHash`.
- Added `requireAuth`, `getAuthenticatedUser`, `requireRole`, the Express request augmentation, and the six specified database-free unit tests.
- Added the idempotent three-user seed command. The first successful run created all three users; the second reported all three as already present.
- Added Redux Toolkit authentication state, typed store hooks, centralized client-side 401 expiry handling, session bootstrap before render, protected routing, role-based start paths/sidebar items, and the authenticated application shell.
- Added login, registration, forbidden, profile, and profile-edit pages. All four forms use React Hook Form with the corresponding `shared/` Zod resolver, server field errors, independent submission state, disabled invalid/in-flight submission, and success feedback.
- Preserved the expected intermediate state: a signed-in student lands on the not-yet-implemented `/learning` 404 with the role sidebar; `/admin` likewise renders the 404 inside the authenticated shell.
- Added only the dependency majors allowed by the prompt. Resolved versions are `bcryptjs` 3.0.3, `jsonwebtoken` 9.0.3, `@types/jsonwebtoken` 9.0.10, Redux Toolkit 2.12.0, React Redux 9.3.0, React Hook Form 7.87.0, and `@hookform/resolvers` 5.9.1.

## Verification

- `npm install` — passed; 447 packages audited, 0 vulnerabilities.
- `npm run build` — passed. Vite emitted non-failing warnings about comment annotations in the installed Zod package.
- `npm run typecheck` — passed for `shared`, `server`, and `client`.
- `npm run lint` — passed.
- `npm run test` — passed: 8 server tests and 2 client tests.
- `npm run db:up` — passed; `lms-mongo` remains running as required.
- `npm run seed` — passed twice; the second run confirmed that all three users were skipped as already present.
- `npm run dev` — server listened on 4000 and Vite on 5173. Both processes were stopped after the checks; neither port remained listening.

Manual results:

1. Correct student login returned `200`, the public user body, and `Set-Cookie: session=...; Max-Age=604800; Path=/; ...; HttpOnly; SameSite=Lax`.
2. `GET /api/auth/me` returned `200` with the cookie and `401 {"code":"unauthorized","message":"Требуется авторизация"}` without it.
3. A wrong password returned `401 {"code":"invalid_credentials","message":"Неверный email или пароль"}`.
4. After setting the already-authenticated student's status to `blocked`, the same cookie returned exactly `401 {"code":"account_blocked","message":"Учетная запись заблокирована"}` and a clearing `session` cookie. The student status was restored to `active` immediately afterwards.
5. A wrong current password returned `422 {"code":"invalid_current_password","message":"Неверный текущий пароль"}`.
6. Browser verification logged in as the student, showed the student sidebar, opened `/profile`, changed the name to `Обучающийся Петров Проверка`, and showed the new name in the global sidebar and profile without another login. The seeded name was restored afterwards. Direct navigation to `/admin` showed the expected 404 inside the sidebar shell. Browser logs contained no warnings or errors.
7. No response body observed in the flow contained `passwordHash`.

## Shared-schema values and open decisions

No request or response field was missing from `shared/`, and nothing under `shared/` was changed. Values needed outside those wire schemas were:

- session cookie/JWT lifetime, flags, name, secret minimum, and bcrypt cost in the auth helpers — supplied by the prompt;
- endpoint-specific statuses, error codes, the email field error, login opacity text, route destinations, navigation labels, and seed records — supplied by the prompt;
- Russian role display labels in `navItems.ts` — derived from specification sections 3 and 5 because `userRoleSchema` contains machine values only;
- generic Russian text for unauthorized, forbidden, a blocked live session, invalid current password, successful profile/password saves, and an absent group — the prompt fixed the behavior/code but not every display string;
- a user disappearing between `requireAuth` and a profile handler is treated as `401 unauthorized`; the prompt did not specify that race;
- anonymous/error-state auth pages remain usable while protected/root session errors show retry UI; the prompt specified protected-shell retry behavior but did not explicitly define public-form behavior after a non-401 session probe failure.

These are presentation/configuration values or edge-case behavior, not invented wire-contract fields.

## Departures and extra files

- There were no behavioral departures from the slice prompt and no files under `shared/` or `client/src/components/ui/` were modified.
- `package-lock.json` is the only tracked implementation file touched outside the explicit file list. `npm install` necessarily updated it to lock the required dependencies.
- The ignored local `server/.env` was given a development-only 32+ character `JWT_SECRET` for the mandated live checks; it is not committed. The tracked `server/.env.example` contains only a placeholder.
- `.codex/reports/slice-02.md` is created because the handover section explicitly requires it.

## Blocked or incomplete work

- None.

## Out-of-scope observations

- Docker Compose warned that the existing `lms-mongo-data` volume was not originally created by the current Compose project. The shared container operated normally, so it was left running and unchanged.
- Vite/Rollup reported removable annotation comments in installed Zod sources during production builds; the build succeeded and no dependency change was permitted or needed.
