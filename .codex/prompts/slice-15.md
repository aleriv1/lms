# Slice 15 — end-to-end tests for what only a browser can prove

Read `AGENTS.md` first. It outranks this prompt. The specification outranks
both. Section 9 has just been amended for this slice: a scripted Playwright run
is a gate, not an observation, and it is the one case where you may start
servers. Everything else in section 9 still holds — no `--headed`, no `--ui`, no
screenshots, no trace viewer, no HTML report.

Every slice so far has ended with a manual checklist that a person had to click
through, and the checklists have piled up unread: slices 07, 08, 13 and 14 hold
about twenty-five of them. jsdom cannot reach them — a real `beforeunload`
prompt, an Escape key on a portal dialog, a page taken offline. This slice turns
the reachable ones into a suite that runs on demand and reports one line each.

**Do not change any component, slice, route or server file.** If a scenario
cannot be written without changing one, stop and hand it back: that is a defect
report, not a licence to edit. The exceptions are named under «Files».

## Before you start — read these

- `server/src/scripts/seed.ts` — every course, lesson, test, question and option
  the scenarios below name. **Take the exact strings from here, not from this
  prompt.** The quotations below are pointers; the seed is the source. Note the
  `--reset` flag and what it clears.
- `server/.env.example` — `PORT`, `MONGODB_URI`, `CLIENT_ORIGIN`, `JWT_SECRET`.
  `server/src/index.ts` loads `dotenv/config`, which does **not** override
  variables already set in the environment. That is what lets the e2e run point
  at its own port and its own database without touching `server/.env`.
- `client/src/api/client.ts` — `const baseUrl = import.meta.env.VITE_API_URL ||
  "/api"`. Setting `VITE_API_URL` lets the e2e client talk to the e2e server
  directly, so no Vite proxy and no change to `client/vite.config.ts`.
- `client/src/routes/UnsavedChangesGuard.tsx` and its test
  `client/src/routes/UnsavedChangesGuard.test.tsx` — what is already proven in
  jsdom. Do not re-prove it. Suite A covers only what jsdom cannot reach.
- `client/src/components/ui/Modal/Modal.tsx` — the dialog is a portal with
  `role="dialog"`; find out from the component whether Escape and the close
  button are wired, and assert what it actually does.
- `.codex/reports/slice-13-client.md`, `slice-13-server.md`, `slice-07-client.md`,
  `slice-08-client.md`, `slice-14.md` — the `## Проверить руками` sections. Your
  report must say which numbered items of which report each scenario retires.

## Files

Write (new):

- `playwright.config.ts` (repository root)
- `e2e/global-setup.ts`
- `e2e/helpers/auth.ts`
- `e2e/unsaved-changes.spec.ts`
- `e2e/attempt-review.spec.ts`
- `e2e/offline.spec.ts`

Change (these only):

- `package.json` at the root — add `@playwright/test` **1.62.1** to
  `devDependencies` and a `test:e2e` script. **Do not add e2e to `npm run
  test`.** That script must stay fast and must not grow a browser download.
  **Corrected by the review of this slice: «must keep working with no Docker and
  no database» was wrong**, and the prompt asserted it without the `grep` that
  README line 79 would have answered — the server suite connects to a real
  MongoDB through `connectTestDatabase`, and it did so long before this slice.
  The requirement that was meant is the one Codex actually checked: e2e must not
  leak into `npm run test`.
- `.gitignore` — `playwright-report/`, `test-results/`, and whatever else the
  run drops.

**If the gate turns up a config file that has to know about `e2e/` — the ESLint
config, a tsconfig — fix it minimally and name it in the report; do not stop.**
That licence covers configuration only. It does not cover a component, a slice,
a route or a server file.

Run `npx playwright install chromium` once. Chromium only: this project has no
cross-browser requirement, and two more browsers are two more downloads.

## Decisions already made — implement, do not reconsider

**Its own database, its own ports.** The developer's dev servers own 5173 and
4000 and their database holds work you must not destroy. The e2e run uses:

- server: `PORT=4100`, `MONGODB_URI=mongodb://localhost:27017/corporate-learning-e2e`,
  `CLIENT_ORIGIN=http://localhost:5273`
- client: `npm run dev -w client -- --port 5273 --strictPort`, with
  `VITE_API_URL=http://localhost:4100/api`
- `baseURL: "http://localhost:5273"`

Both are `webServer` entries in `playwright.config.ts`. `reuseExistingServer:
false` — a stale server on the port is a failure, not something to reuse.

`e2e/global-setup.ts` runs the seed against that database with `--reset`, so
every run starts from the same rows and a scenario may assert on an attempt
number. It must fail loudly if MongoDB is not up; the gate below brings it up.

**One login helper, through the UI.** `e2e/helpers/auth.ts` exports
`login(page, email)` that fills the real form on `/login` with the seed password
and waits for the authenticated landing. No API shortcut, no forged cookie: the
login path is itself under test. Successful logins do not touch the rate
limiter — only failures do — so this is safe to call in every test.

**Serial, one worker.** `workers: 1`, `fullyParallel: false`. The suite shares
one database and one server process; parallel workers would race over the same
rows. `reporter: "list"`, `trace: "retain-on-failure"`, `retries: 0`. A flaky
scenario is a defect to report, not something to paper over with a retry.

**Assert on roles and accessible names**, the way the jsdom tests do —
`getByRole("dialog", { name: … })`, `getByRole("link", { name: … })`. Do not
write CSS-class selectors: they would make the suite fail on a restyle and pass
on a broken dialog.

## Scenarios

Three files. Each `test` is named after the behaviour, in the shape the existing
tests use. Where a scenario says «the dialog», it is the in-app modal unless the
text says «browser dialog».

### A. `e2e/unsaved-changes.spec.ts` — as `admin@lms.local`

The admin passes `roles={["teacher", "admin"]}` on `/manage/*`, so one account
covers all of these.

1. **Escape and the close button keep the form.** `/manage/courses/new`, type a
   title, click «Назад в каталог» → the dialog appears. Press Escape → the
   dialog is gone, the URL is still the form, the typed title is still there.
   Click the link again, close the dialog with its close button → same three
   assertions. Click the link again, «Остаться» → same. Then «Уйти без
   сохранения» → the catalogue. Retires slice-13-client item 1.
2. **A real `beforeunload` on reload.** On the same form with a typed title,
   reload the page with a `dialog` listener attached, dismiss the browser
   dialog, and assert the form is still there with the text in it. Then clear
   the field and reload again: no browser dialog fires. Typing is the user
   gesture Chromium requires before it will show that prompt — if the first
   assertion cannot be made honestly, say so in the report and drop the case
   rather than asserting on a listener. Retires the reload half of
   slice-13-client item 2. **Corrected by the review of this slice: slice-14
   item 1 names `/profile/edit`, which this scenario does not open** — it proves
   the shared mechanism on the course form, and the profile page stays manual.
3. **A saved lesson stops asking.** Open the seeded course, then one of its
   lessons from the outline, change the title, click «Назад к курсу» → dialog →
   «Остаться». Save, wait for the success message, click «Назад к курсу» again →
   no dialog, the course page opens. Retires slice-13-client item 4.
4. **A saved course stops asking.** The same shape on the course editor itself.
   This is the regression test for the fix committed with slice 13: before it,
   `CourseForm` stayed dirty after a successful save and asked about leaving a
   page that was already saved.
5. **One guard over two forms on the user page.** `/admin/users`, open a seeded
   learner. Change only the name → «Назад к пользователям» asks. Reload, change
   only the assignable course → the same link asks. Reload, touch neither → the
   link goes to the list with no dialog. Retires slice-13-client item 12, which
   is still written there as not implemented.
6. **Signing out of a dirty form does not ask.** Type into the course form,
   click «Выйти» in the sidebar → `/login`, no dialog. Then log in again as the
   learner of scenario 5 and assert the sidebar is theirs, not the admin's: the
   old form must not come back. Retires slice-13-client item 7. Put this last in
   the file — it ends the session.

### B. `e2e/attempt-review.spec.ts` — as `student@lms.local`

The breakdown's markup is already proven in
`client/src/features/learning/AttemptReview.test.tsx`. What is unproven is the
wiring: that the server's review reaches that component through a real attempt.

1. **A wrong answer is labelled on both sides.** Reach a lesson test through
   `/learning` — course, lesson, test, following the links, never assembling a
   URL from an id. Choose a wrong option, submit, confirm the in-app
   confirmation if the form raises one → «Неверно»; the chosen option carries
   «ваш выбор» and not «правильный ответ»; the correct option carries
   «правильный ответ» and not «ваш выбор».
2. **A correct answer carries both labels.** «Пройти ещё раз», choose the
   correct option, submit → «Верно», and that option carries both labels.
3. **An empty submission says so.** «Пройти ещё раз», submit with nothing
   chosen, confirm the dialog the form raises → «Вы не ответили», and the
   correct option is still marked. Retires slice-13-client items 8–9.
   **Corrected by the review of this slice: item 10 is the multiple-choice test
   and no scenario here reaches it; it stays manual.**

### C. `e2e/offline.spec.ts` — as `student@lms.local`

1. **`/learning` recovers from a dead network.** With the page loaded, take the
   context offline, navigate away and back → the error state with its retry
   control, and no crash. Bring the context back online, use the retry → the
   cards render. Retires the first third of slice-07-client item 11.

## What this slice does not do

- **No rate-limit scenario.** The counters live in the server process and key on
  the account and the address; five wrong passwords lock `student@lms.local` for
  fifteen minutes and every later scenario in the run with it. slice-13-server
  items 1 and 5 stay manual, and the report must say so.
- **No two-tab archive race** (slice-07-client item 12, slice-08-client). It
  needs two contexts and it archives a course the rest of the suite reads.
- **No WCAG work.** Keyboard and contrast are a separate measurement, and
  Playwright would only give the illusion of one.
- **No new fixtures.** Everything comes from the seed. Do not create a course, a
  user or an assignment to make a scenario work; if the seed cannot support a
  scenario, drop it and say so.
- **No screenshot assertions, no visual diffing.** Assert on roles, names and
  URLs.

## Gate

From the repository root, in this order:

```
npm run db:up
npm run build && npm run typecheck && npm run lint && npm run test
npm run test:e2e
```

`npm run db:up` starts MongoDB in Docker; the e2e database is separate from the
developer's and `global-setup` reseeds it. Do not run `npm run seed` against the
default database. Do not start `npm run dev`.

## Self-report

`.codex/reports/slice-15.md`, in the format of `AGENTS.md` (8). Section 5 —
«claim → check → result», one line per claim including the ones that held — is
mandatory and must cover at least:

- every scenario above: present and green, or dropped with the reason;
- for each one, which numbered items of which earlier report it retires;
- that e2e did not leak into `npm run test` — the script's own diff, and the
  gate's own run with MongoDB up. **Corrected by the review of this slice: the
  original wording, «still passes with Docker stopped», asked for a check of a
  condition that never held.**
- that no file outside the list under «Files» changed (`git diff --stat` against
  the commit before yours);
- the resolved version of `@playwright/test` and of the Chromium it installed.

End with `## Проверить руками` naming what is still manual after this slice —
the rate limit, the archive race, and anything you dropped. One commit, no push,
no amend.
