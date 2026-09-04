# Slice 16 — finish the manual checklist

Read `AGENTS.md` first. It outranks this prompt. The specification outranks
both. Section 9 stands as amended for slice 15: a scripted Playwright run is a
gate, not an observation, and it is the one case where you may start servers.
No `--headed`, no `--ui`, no screenshots, no trace viewer, no HTML report.

Slice 15 turned about seventeen of the twenty-five accumulated manual checks
into ten scenarios. This slice takes the rest of the automatable ones. After it,
exactly two things stay manual for the life of the project: **closing a tab**
(Playwright cannot raise that browser dialog honestly) and **WCAG measurement**,
which is a different kind of work. There is no slice 17 of this shape.

**Do not change any component, slice, route or server file.** If a scenario
cannot be written without changing one, stop and hand it back: that is a defect
report, not a licence to edit. The exceptions are named under «Files».

## Two facts established by the review of slice 15 — do not re-derive them

- **The rate-limit items are already retired, by reading, not by a browser.**
  `server/src/middleware/loginRateLimit.test.ts` holds seven cases including the
  fixed window, cross-email counting and the address counter surviving a
  success; `server/src/routes/auth.test.ts` holds the route-level 429 with
  `Retry-After`. A browser cannot tell you anything about a counter those tests
  do not already state. **Do not write a rate-limit scenario.** It would also
  spend the address budget — 20 failures per 15 minutes, shared by the whole
  run — on nothing.
- **The manual checklist itself has rot: item 2 of `.codex/reports/slice-15.md`
  is wrong.** It says the right password is refused inside the window.
  `server/src/routes/auth.ts` asks the account gate only on the wrong-password
  branch and clears the counter on success, and `auth.test.ts` proves the owner
  signs in with a full counter. Treat every quoted expectation in an old
  checklist the same way: **the code is the source, the checklist is a pointer.**

## Before you start — read these

- `playwright.config.ts`, `e2e/global-setup.ts`, `e2e/helpers/auth.ts` and the
  three existing specs. This slice extends that suite; match its shape — roles
  and accessible names, no CSS selectors, no waits on timers.
- `server/src/scripts/seed.ts`. **Take every string from here.** The quotations
  below are pointers, and they were checked against the seed on 04.09.2026; if
  one disagrees with the seed, the seed wins and the report says so.
- `client/src/pages/LearningLessonPage.tsx` — how a failed action renders:
  `role="alert"` with the server's message, plus a «Вернуться к курсу» link for
  the codes `lesson_locked`, `not_found` and `forbidden`. The complete button
  renders only when the lesson has no required test and the course is not
  archived.
- `client/src/pages/CourseListPage.tsx` — the row actions. «Опубликовать» acts
  immediately; «Архивировать» opens a confirmation whose own button is
  «Архивировать».
- `client/src/pages/ProfileEditPage.tsx` — the two blocks and their labels
  («Имя», «Email», «Текущий пароль», «Новый пароль», «Повторите новый пароль»).
  Whether a label renders with a ` *` suffix is a property of the field; read it
  off the page rather than guessing the accessible name.
- `.codex/reports/slice-15.md`, section «Проверить руками» — the eight items.
  Your report must say which of them each scenario retires.

## Facts about the seed this slice depends on

Checked while writing this prompt; check them again if a scenario does not fit.

- `student@lms.local` has three assignments: «Вводный инструктаж по охране
  труда» (completed, five lessons), «Правила технической эксплуатации» (active,
  one lesson completed) and an archived course.
- The multiple-choice test «Проверка средств индивидуальной защиты» hangs on
  lesson 5 of the intro course, «Проверка готовности к безопасной работе».
  Options: «Защитная каска» (correct), «Защитные очки» (correct), «Служебный
  автомобиль» (wrong). The learner already holds one attempt on it, so the next
  one is №2.
- In «Правила технической эксплуатации» the learner has finished lesson 1
  («Допуск к работам на оборудовании»), so lesson 2, «Журнал осмотров: как
  заполнять», is the unlocked one. That course's test is course-level
  (`lessonOrder: null`), so lesson 2 has **no** required test and does show
  «Завершить урок».
- Acting on an archived course answers 403 `forbidden` with the message «Курс
  архивирован: новые действия по нему недоступны».

## Files

Change (these only):

- `playwright.config.ts` — projects, see «Ordering» below.
- `e2e/offline.spec.ts` — one added test.
- `e2e/unsaved-changes.spec.ts` — one added test.

Write (new):

- `e2e/multiple-choice.spec.ts`
- `e2e/profile-edit.spec.ts`
- `e2e/archive-race.spec.ts`

No dependency is added. No component, route, slice or server file is touched.

## Decisions already made — implement, do not reconsider

**Ordering is guaranteed by config, not by filenames.** `archive-race.spec.ts`
archives courses the rest of the suite reads, so it runs last, and «last» has to
be a guarantee:

```ts
projects: [
  { name: "main", testIgnore: /archive-race\.spec\.ts/ },
  {
    name: "isolated",
    testMatch: /archive-race\.spec\.ts/,
    dependencies: ["main"],
  },
];
```

Top-level `use` is inherited by both. A failure in `main` skips `isolated`; that
is correct — a suite that already failed should not go on to archive things.

**The race spec restores what it archives** in `afterAll`, by «Опубликовать» in
the manage catalogue. The reseed in `global-setup` is the safety net, not the
plan: leaving the run's own database wrong is still leaving it wrong.

**Nothing outside `archive-race.spec.ts` may complete lesson 2 of «Правила
технической эксплуатации».** The race needs that «Завершить урок» button to
exist. This is why the offline scenario below stops where it does.

**No new fixtures.** Everything comes from the seed. No new course, user or
assignment. **No saved password**: the profile scenario types into the password
block and leaves without saving, so the seed password stays `Password1`.

## Scenarios

### D. `e2e/multiple-choice.spec.ts` — as `student@lms.local`

Reach lesson 5 of the intro course through `/learning`, following links; never
assemble a URL from an id. One `describe` in serial mode, one page, as
`attempt-review.spec.ts` does.

1. **A partially correct answer is wrong and both labels land separately.**
   Start the test, tick only «Защитная каска», submit, confirm if the form
   raises a confirmation → «Неверно»; «Защитная каска» carries both «ваш выбор»
   and «правильный ответ»; «Защитные очки» carries «правильный ответ» and not
   «ваш выбор»; «Служебный автомобиль» carries neither.
2. **Both correct options pass.** «Пройти ещё раз», tick «Защитная каска» and
   «Защитные очки», submit → «Верно», and both carry both labels.

Retires item 5 of the slice-15 checklist (slice-13-client item 10).

### E. `e2e/profile-edit.spec.ts` — as `admin@lms.local`

1. **A real `beforeunload` on `/profile/edit`.** Type into the name field —
   typing is the gesture Chromium requires before it will show the prompt —
   reload with a `dialog` listener attached, dismiss it, and assert the URL and
   the typed name survive. `unsaved-changes.spec.ts` shows the working shape:
   `page.evaluate(() => window.location.reload())`, because a dismissed
   `page.reload()` never gets its load event. Retires the profile half of
   slice-15 item 6 — the part slice 15 could only prove on the course form.
2. **One dialog, whichever block is dirty.** Change only the name → «Назад в
   личный кабинет» raises exactly one «Покинуть страницу?» → «Остаться» keeps
   the input. Discard by reloading, then type only into «Новый пароль» → one
   dialog again. Discard, then dirty both blocks → still exactly one dialog, and
   «Остаться» keeps both inputs. Assert the count, not just the visibility.
   Retires the rest of slice-15 item 6 (slice-13-client item 6), except closing
   the tab.

### F. `e2e/unsaved-changes.spec.ts` — one added test, as `admin@lms.local`

**Both blocks of the user card at once.** `/admin/users`, open
`student@lms.local` the way the existing test does. Change the name **and**
choose «Работа с диспетчерской системой» → «Назад к пользователям» raises
exactly one dialog → «Остаться» keeps both inputs. Leave without saving, and
assert after a discarding reload that no assignment was created. Retires
slice-15 item 7 (the remainder of slice-13-client item 12).

### G. `e2e/offline.spec.ts` — one added test, as `student@lms.local`

**A lesson page survives a dead network.** Open «Правила технической
эксплуатации» → «Журнал осмотров: как заполнять» and read the material. Take the
context offline, click «Завершить урок» → the `role="alert"` error appears, the
material is still on screen, the URL is unchanged, and nothing lands on
`/forbidden`. Come back online and navigate away and back → the lesson loads
again and the button is there. **Stop there: do not complete the lesson.**
Retires the action half of slice-15 item 8 (slice-07-client item 11); say in the
report that the successful retry stays manual because the race spec needs the
lesson untouched.

### H. `e2e/archive-race.spec.ts` — two contexts, runs last

The learner keeps a page open while an administrator archives the course under
them. Use the default `page` for the learner and a second context for
`admin@lms.local`. Serial mode; `afterAll` republishes both courses.

1. **A lesson archived under the learner.** Learner: «Правила технической
   эксплуатации» → «Журнал осмотров: как заполнять», stay there. Admin:
   `/manage/courses`, archive that course through the confirmation. Learner
   clicks «Завершить урок» → the `role="alert"` carries «Курс архивирован: новые
   действия по нему недоступны», the URL is still the lesson, and the page did
   not navigate to `/forbidden`. Reload: the material is still readable and the
   complete button is gone. Retires slice-15 item 3 (slice-07-client item 12).
2. **A test archived under the learner.** Learner: the intro course → «Действия
   при обнаружении опасности» → «Пройти тест ещё раз», choose an option, do not
   submit. Admin: archive the intro course. Learner submits → the server refuses
   and no new attempt appears; the review does not render. Reload, discarding
   the unsaved answer, and assert the test cannot be started. Retires slice-15
   item 4 (the archive branch of slice-08-client).

Republish both courses in `afterAll` and assert the catalogue shows them
published again.

## What this slice does not do

- **No rate-limit scenario.** See the first section.
- **No tab-close scenario.** Playwright's `page.close()` does not raise the
  browser's own leave prompt, and asserting on a registered listener is not a
  check. It stays manual, permanently, and the report says so.
- **No WCAG.** Contrast and keyboard traversal are a measurement, and a
  Playwright pass would only look like one.
- **No visual diffing, no screenshot assertions.**

## Gate

From the repository root, in this order:

```
npm run db:up
npm run build && npm run typecheck && npm run lint && npm run test
npm run test:e2e
```

`npm run test` needs MongoDB — that is what `db:up` is for, and it has always
been so. The browser is a per-machine download: if `npm run test:e2e` fails with
`Executable doesn't exist`, run `npx playwright install chromium` once. Do not
run `npm run dev`. Do not run `npm run seed` against the default database.

## Self-report

`.codex/reports/slice-16.md`, in the format of `AGENTS.md` (8). Section 5 —
«claim → check → result», one line per claim including the ones that held — is
mandatory and must cover at least:

- every scenario above: present and green, or dropped with the reason;
- for each one, which numbered item of `.codex/reports/slice-15.md` it retires;
- that the isolated project really ran after `main`, and that both courses are
  published again when the run ends;
- that no file outside «Files» changed (`git diff --stat` against the commit
  before yours);
- each of the five seed facts above, confirmed against `seed.ts` or corrected.

End with `## Проверить руками` naming what is still manual: closing a tab, the
successful retry of scenario G, and WCAG. Nothing else should be left on that
list. One commit, no push, no amend.
