# AGENTS.md — invariants for the LMS course project

Rules that hold across every slice. Per-slice work (file lists, signatures,
acceptance checks) lives in `.codex/prompts/slice-NN.md`. This file does not
restate the specification; it states what must never drift.

## 1. Authority order

1. `technical-specification.md` — the requirements. Russian, v1.2. Section
   numbers are cited throughout this file.
2. `shared/` — the wire contract. Zod schemas, inferred types, enums, constants.
3. `AGENTS.md` — this file.
4. `.codex/prompts/slice-NN.md` — the current slice.

A prompt never overrides the specification. If a prompt and the specification
disagree, stop and report the conflict in the self-report instead of choosing
one. Never invent a requirement that appears in none of these files.

`legend/` and `tz-example-(the-blog).md` are not requirements. Do not read them
for behaviour.

## 2. Boundaries of your authority

Architectural decisions are made outside this repository and arrive through
prompts. You implement them.

Do not, on your own initiative: add dependencies, introduce a state-management
or data-fetching library, change the folder layout, rename an exported contract,
add abstraction layers (repositories, generic CRUD factories, dependency
injection containers, custom hook frameworks), or "improve" a schema in
`shared/`.

If a slice cannot be completed without one of these, stop and say so in the
self-report. A blocked slice reported honestly is a good outcome; a slice
completed by guessing is not.

## 3. Contracts

`shared/` is the single source of truth for the shape of every request and
response (specification 10.4). The server validates with these schemas, both
sides derive their types from them, and client forms validate against them
through the React Hook Form resolver.

- Never redeclare a schema or a type from `shared/` inside `client/` or
  `server/`. Import it.
- Never hand-write a TypeScript interface that duplicates an inferred type. Use
  the `z.infer` output exported by the package.
- Russian validation messages live in the input schemas in `shared/`. The client
  displays them as they arrive and does not translate or rewrite them.
- `shared/` compiles to `dist/` and is consumed as `@lms/shared`. Build it before
  type-checking `client/` or `server/`.
- Changing a schema is a contract change: it belongs to a prompt that asks for
  it, never to an unrelated slice.

Envelopes are fixed:

- List responses use `createListResponseSchema(item)` — `{ items, meta }` with
  `meta` as `{ page, pageSize, total, totalPages }`.
- Errors use `apiErrorSchema` — `{ code, message, fields? }` where `code` is a
  member of `API_ERROR_CODES`. The client branches on `code`, never on
  `message`. Do not add error codes without a prompt.

## 4. Repository and commands

Three npm workspaces: `client/` (React 19, Vite), `server/` (Express 5,
Mongoose), `shared/` (contracts). TypeScript `strict` in all three.

Root scripts. All but `seed` are created in the first slice; `seed` arrives in
the slice that first has data to write. Once a script exists it keeps working:

- `npm install` — install all workspaces
- `npm run build` — shared, then server, then client
- `npm run typecheck` — all three workspaces
- `npm run lint` — all three workspaces
- `npm run test` — automated tests
- `npm run dev` — client and server in watch mode
- `npm run seed` — demo data (from slice 02 on)

A slice is not finished while any of `typecheck`, `lint`, `build` or `test`
fails. Run them yourself before writing the self-report.

Configuration comes from environment variables. No secrets, connection strings
or tokens in the repository; `.env.example` documents the variable names with
placeholder values.

## 5. Server invariants

These are the areas that get reviewed line by line. Get them right.

**Authorisation.** Every protected route checks role, course authorship and
assignment as applicable (specification 3.2, 10.3). A route-level role check is
not enough on its own — ownership of the specific entity is checked too. Hiding
a control in the UI is never a substitute for a server check.

**Account status.** The account status is re-read from the database on every
protected request, not only at login. Blocking a user immediately invalidates
their existing session (specification 3.1).

**Server-computed values.** Course progress, test scores, pass/fail and lesson
access state are computed on the server (specification 4.3, 4.4). The client
never sends a computed percentage and never decides whether an answer is
correct. Progress is the share of completed required published lessons, rounded
to a whole number; optional lessons are excluded. A multiple-choice question
scores only on an exact match of the selected set — no partial credit.

**Response leakage.** No response ever contains `passwordHash`, secrets, or
correct answers for a learner. `GET /learning/tests/:testId` returns the test
without correct options; correctness is revealed only after an attempt is
submitted (specification 4.4, 10.3).

**Data safety.** Editing or unpublishing content never deletes stored progress.
Deleting a published course that has assignments or progress is refused — it is
archived instead (specification 4.2).

**Validation.** Every mutating request is validated on the server against the
`shared/` schema for that route, in middleware, before the handler runs.
Learning material HTML/Markdown is sanitised before it is stored.

**Statuses.** Use the codes listed in specification 9.5 — `201` on create, `204`
on success without a body, `403` for insufficient rights, `404` for a missing
entity, `409` for uniqueness or state conflicts, `422` for business validation.
A `500` response never exposes internal details.

**Passwords** are hashed with bcrypt or Argon2. The session is a JWT in an
`httpOnly` cookie. Login is rate-limited.

## 6. Client invariants

- Redux Toolkit for global state, its thunks for async work. No parallel
  data-fetching layer.
- One API client module; authorisation errors are handled centrally there.
- React Hook Form with the Zod resolver over `shared/` schemas. No hand-rolled
  form validation.
- CSS Modules plus the shared design-token file. No UI kit, no CSS-in-JS.
- Base components (`Button`, `Input`, `Select`, `Textarea`, `Checkbox`, `Modal`,
  `Table`, `Pagination`, `Loader`, `EmptyState`, `ErrorState`) are written once
  and reused. Do not style a one-off button inline.
- Every screen that loads data handles four states: loading, empty, error and
  data. An unhandled state is a defect, not a detail.
- Server-computed values (rights, percentages, results) are displayed, never
  recomputed or kept as the client-side source of truth (specification 10.1).
- Forms are protected against double submission while a request is in flight.
- A logged-in user without the required role sees the "no access" page; a
  logged-out user is redirected to login (specification 3.1).

## 7. Code style

Write the canonical, boring version of the course stack. The reader is a student
defending this project, not a framework author.

- Clarity over cleverness. No custom abstraction where a plain function,
  component or middleware does the job.
- Names in English; user-facing text and validation messages in Russian.
- Comments explain why, and only where the reason is not evident. No commented-
  out code, no `TODO` left behind, no dead exports.
- No `any`, no `@ts-ignore`, no non-null assertion used to silence the compiler.
  If the types do not fit, the contract is wrong — report it.
- Follow the conventions already present in the files you touch.

## 8. Finishing a slice

Before reporting, run the gate of section 9 and compare what you changed against
the file list in the prompt.

Then write a self-report to `.codex/reports/slice-NN.md` containing, briefly:

1. what was done, per checklist item;
2. where you departed from the prompt, and why;
3. what you could not do, and what blocked it;
4. anything you noticed that looks wrong but was out of scope.

Item 2 includes the case where the prompt contradicted itself and you picked a
reading. Building something the prompt's own structure did not describe is a
departure even when the prompt left you no consistent alternative, and it is the
most valuable line in the report: it is how a prompt defect gets fixed instead of
being copied into the next slice. "No departures" is a claim about the prompt,
not only about your work.

Stop every process you started — dev servers above all. A watcher survives the
crash that made you leave it, keeps the port, and the next run fails with
`EADDRINUSE` on someone else's machine, where it reads as a defect in working
code. Leaving a container running is fine; it is shared infrastructure.

Then make exactly one commit containing the slice and its report, on the current
branch. Subject line in English, imperative, up to ~50 characters, naming the
slice — `Build the repository skeleton and design system`. Body explains why the
work is shaped the way it is, not which files moved. Do not push, do not amend
or rebase earlier commits, and do not commit while a required command fails.

Hand the work over there and stop. Whether the slice is accepted is decided in
review, outside this repository — do not declare it closed, and do not start the
next slice.

Do not hand over a slice while a required command fails. Say what fails and why
instead.

## 9. Verification is not free

Every observation you make is paid for twice: once when it is taken, and again
on every later turn, because it stays in the conversation for the rest of the
session. A page dump or a screenshot is the most expensive thing you can look
at. This project's budget is measured in five-hour windows, and a slice that
does not fit inside one has failed regardless of the code in it.

So verification is split by who is cheaper at it, not by who is capable of it.

**Yours — the machine gate, once, at the end.** `npm run typecheck`, `npm run
lint`, `npm run test`, `npm run build`. One line of result each in the report.
Do not run `npm install` unless you changed `package.json`. Do not run `npm run
seed` unless the prompt asks for it. Do not start `npm run dev`. Do not open a
browser for any reason — not to check a screen, not to confirm a route, not to
watch a state. There is no exception for looking just once to be sure.

**The developer's — everything that needs the application running.** They have
it open already and pay nothing to click. Your work is to make their pass short
and exact: end the self-report with a numbered checklist under `## Проверить
руками`, each item naming the URL, the input, and the result that would mean
success. Start from a seeded database and from navigation the developer can
follow — a step that asks them to assemble a URL from an identifier they do not
have is not a step. Write it for someone who has not read your code. A defect they find
comes back as a fix prompt; a checklist they cannot follow is a defect in your
report.

**Nobody's — fixtures made by hand.** Do not create courses, lessons, users or
any other test data through the UI or the API, and do not write cleanup scripts
for data you should not have made. What the checklist needs comes from `npm run
seed` or already exists.

Pure logic still gets unit tests: they are cheap to run and they catch what a
person cannot see by looking — permission rules, server-side calculations,
ordering, sanitisation, contract conformance. Rendering is not unit-tested here.
