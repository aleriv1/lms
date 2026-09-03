# Slice 08, server half — review brief

You are reviewing code you did not write. The server half of slice 08 was
written by Claude and is already committed (`e72ae4e`). Your job is to find out
whether it does what it claims, by running it — not by reading it and forming an
opinion.

Read, in this order: `AGENTS.md`, `.claude/specs/slice-08-server.md` (the
specification), `.claude/reports/slice-08-server.md` (the self-report). Then
this brief. Do not read the diff end to end; read the handlers you are about to
call.

Write your findings to `.codex/reports/slice-08-server-review.md`. Make exactly
one commit containing that report. **Do not fix anything.** A defect you find is
written down, not repaired: the fix is decided outside this session, and a
review that edits the code it reviews stops being a review.

## 1. What you are not asked to judge

Section 12 of the specification lists eight decisions the technical
specification does not settle — a passing attempt completing the lesson, the
final test not being locked by lessons, no server-side de-duplication of
attempts, the answer-normalisation rules, string identifiers inside the attempt,
the loose comparison against the passing score, 201 on creation, and submission
being refused on an archived course while reading is allowed.

**Leave all eight alone.** They are arguments about what the requirements
demand, they are settled by a separate Claude session, and a verdict from you
saying "the code matches the specification" is worth nothing there: the
specification and the code were written by the same session, so they agree by
construction, including wherever the specification is wrong.

If while running something you observe a *behaviour* that contradicts one of
those decisions as written — say the final test turns out to be locked after all
— that is a finding, and a valuable one. The behaviour is yours to report; the
decision is not yours to overturn.

## 2. Every verdict carries the command that produced it

This is the whole point of asking you rather than a reader. For each claim in
your report, one line: the claim, the exact command or request, the output you
got. A claim that held gets its line too.

A verdict with no command behind it is worth nothing and will be treated as
noise. If you could not check something, say "not checked" and why — that is a
usable answer. "Looks correct" is not.

## 3. Environment

Mongo runs in Docker and is already up; if it is not, `npm run db:up`. The
database already holds seeded data — **do not run `npm run seed`**, do not
create courses, lessons or users, and do not write cleanup scripts. Demo
accounts are `student@lms.local`, `teacher@lms.local`, `admin@lms.local`, all
with the password `Password1`.

Do not open a browser and do not start the client. Everything below is reachable
with `curl` or `fetch` against the API, and that is deliberate: the screen for
taking a test is the client half and does not exist yet.

A server may already be listening on port 4000 — check before starting one:

```
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/api/health
```

`200` means one is up and already serving the code you are reviewing once you
have rebuilt; use it and start nothing. Anything else means you start your own:

```
npm run build
cd server && node dist/index.js
```

**From `server/`, not from the repository root.** `dotenv/config` reads `.env`
from the working directory and the file lives in `server/`; started from the
root the process dies with `Invalid environment configuration`, which reads like
a defect in working code. Verified by running it both ways.

Log in and keep the cookie:

```
curl -s -c cookies.txt -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student@lms.local","password":"Password1"}'
```

Then pass `-b cookies.txt` on every later request. Stop the server when you are
done and delete `cookies.txt`.

## 4. The machine gate

`npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`. One line of
result each. The report claims all four are green; confirm or contradict.

## 5. Run the checklist

The ten items are at the end of `.claude/reports/slice-08-server.md`, under
`## Проверить руками`, each with its URL, its input and the result that would
mean success. Run every one of them that does not need the browser — that is
items 1 through 10, all of them, since none of them actually needs a screen.

Items 7 and 9 need states the current database may not have (a locked lesson, a
draft course). If a state is missing, say so and move on; do not manufacture it.

Report per item: PASS, FAIL with the response you got, or NOT CHECKED with the
reason.

## 6. Look at these four things specifically

Beyond the checklist, four places where a defect would be invisible to the
checklist itself:

1. **Correct answers must not leave the server before submission.** Ask
   `GET /api/learning/tests/:testId` and grep the raw response body for
   `isCorrect`, for `correct`, and for any field beyond `id` and `text` on an
   option. The specification claims the mapper builds options field by field and
   that `learnerTestSchema.parse` is a second line of defence. Verify the body,
   not the mapper.

2. **The number of database queries must not grow with the number of lessons or
   tests.** `GET /api/learning/courses/:courseId` is claimed to fetch attempt
   statistics for every test of the course in one aggregation. Confirm it: set
   `mongoose.set("debug", true)` in a scratch run, or count the queries some
   other way you can show. A query per test is a defect (specification 11.2).

3. **A failed attempt must change nothing.** Submit a deliberately wrong
   attempt on the lesson test, then re-read
   `GET /api/learning/courses/:courseId`. The lesson must not become completed,
   the percentage must not move, the assignment must not close.

4. **Repeat submissions must not collide.** Submit the same attempt three times
   in a row and confirm the attempt numbers are 1, 2, 3 with no error and no two
   attempts sharing a number. Then, if you can, fire two submissions
   concurrently (two `curl` processes started together) and report what came
   back — the specification claims a unique index plus a retry loop handles it,
   and this is the one claim in it that a single sequential run cannot test.

## 7. What counts as a defect

- A response that contradicts the schema in `shared/` for that route.
- A refusal with the wrong status or the wrong `code`.
- Anything a learner can reach that the access rules say they cannot — above
  all, a locked lesson's test, an unassigned course's test, a draft lesson's
  test.
- A number computed on the server that is arithmetically wrong.
- A claim in `.claude/reports/slice-08-server.md` that your run contradicts.

Not defects, and not worth writing up: naming, comment style, file layout, how
the code is factored, anything in section 1 of this brief, and anything in
`client/` — the client half of this slice has not been written yet.

## 8. Report format

`.codex/reports/slice-08-server-review.md`:

1. The gate: four lines.
2. The checklist: ten lines, PASS / FAIL / NOT CHECKED.
3. Section 6: four findings with their commands.
4. Defects, most serious first. Each one: what you did, what came back, what you
   expected, and why the difference matters. No severity labels invented on the
   spot — describe the consequence and let the reader rank it.
5. Claim → check → outcome, per `AGENTS.md` section 8 item 5, covering every
   statement your report makes about behaviour, including the ones that held.
6. What you could not check, and what blocked it.

Do not declare the slice closed or open. That is decided outside this session.
