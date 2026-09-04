# Slice 13, server half — login rate limiting, the login timing tail, the answer breakdown

Read `AGENTS.md` first. It outranks this prompt. The specification outranks
both.

This is the last slice. It closes three of the four items listed in
specification 18.3. The fourth (WCAG 2.1 AA) is measured in a review session and
is **not** yours — do not touch styles, colours or focus outlines.

## Goal

1. **`POST /api/auth/login` is limited by rate** (specification 10.3, the line
   «вход ограничивается по частоте запросов»). Today nothing limits it: password
   guessing is slowed only by the cost of bcrypt.
2. **The login handler answers an unknown email in the same time as a wrong
   password.** Today `bcrypt.compare` is skipped when no user is found, so an
   unknown address answers measurably faster and the indistinguishable response
   body is the only thing hiding it. The shared `INVALID_CREDENTIALS` singleton
   goes with it.
3. **The attempt response carries the detailed answer breakdown**
   (specification 18.2): which question was answered wrongly and which option
   was the correct one. The data is already stored — `questionsSnapshot` on the
   attempt keeps the correct flags (8.7) — so this is a projection, not new
   collection.

The client half is a separate prompt and a separate session. **Do not write
screens.** The one client file listed below is a test fixture that would
otherwise go red.

## Revealing correct answers is required here, not a leak

`AGENTS.md` (5, "Response leakage") says correctness «is revealed only after an
attempt is submitted (specification 4.4, 10.3)». That is exactly this response.
`GET /learning/tests/:testId` keeps carrying no `isCorrect` and there is a test
below that holds it to that. Do not "fix" the breakdown away.

## Before you start — read these, then obey what they say

- `server/src/routes/auth.ts` — `INVALID_CREDENTIALS`, the login handler, the
  `!user || !(await verifyPassword(...))` short circuit.
- `server/src/auth/password.ts` — `hashPassword`, `verifyPassword`,
  `PASSWORD_SALT_ROUNDS`.
- `server/src/middleware/validate.ts` — it **replaces** `request.body` with the
  parsed value, and `loginBodySchema.email` is `emailSchema`, which trims and
  lower-cases. That is why the limiter runs *after* `validate` and not before:
  it needs the normalised email as its key.
- `server/src/errors/AppError.ts` and `server/src/middleware/errorHandler.ts` —
  the error envelope. `rate_limited` is **already** in `API_ERROR_CODES`
  (`shared/src/enums.ts`); you are not adding an error code.
- `server/src/models/TestAttempt.ts` — `AttemptQuestionSnapshot`,
  `AttemptOptionSnapshot`, `AttemptAnswer`. Read the comment about string
  identifiers: an `optionId` that belongs to no question is deliberately kept.
- `server/src/learning/attemptScoring.ts` — `isQuestionCorrect`,
  `normalizeAnswers`, `gradeAttempt`. The breakdown reuses `isQuestionCorrect`;
  it does not re-derive correctness.
- `server/src/routes/learningTests.ts` — the `POST /:testId/attempts` handler
  and the `attemptResultSchema.parse({...})` it answers with.
- `server/src/testing/apiClient.ts` — `clearDatabase`, `api`, `signIn`,
  `createUser`, `TEST_PASSWORD`.
- `shared/src/tests.ts` — `attemptResultSchema` and the stale comment above it
  saying the breakdown is not in the contract.

Stop and hand back only if something structural is missing.

## Files

Write (new):

- `server/src/middleware/loginRateLimit.ts`
- `server/src/middleware/loginRateLimit.test.ts`

Change:

- `shared/src/tests.ts`
- `server/src/auth/password.ts`
- `server/src/routes/auth.ts`
- `server/src/routes/auth.test.ts`
- `server/src/learning/attemptScoring.ts`
- `server/src/learning/attemptScoring.test.ts`
- `server/src/routes/learningTests.ts`
- `server/src/routes/learningTests.test.ts`
- `server/src/testing/apiClient.ts`
- `client/src/features/learning/learningSlice.test.ts` — **one line**, see
  decision 6. This is the only file under `client/` you may open.

**Do not add a dependency.** No `express-rate-limit`, no
`rate-limiter-flexible`, no cache library. The limiter is about forty lines of a
`Map` and is written here on purpose: it has to be explainable at the defence.

**Do not add an environment variable.** The numbers below are constants in the
module; `.env.example` does not change.

**Do not enable `trust proxy`.** `request.ip` is the socket peer, which is the
truth for this deployment (the client is served separately by Vite and the API
is reached directly). Turning on `trust proxy` without a proxy in front makes
the key spoofable through `X-Forwarded-For`, which is worse than no limit.

## Decisions already made — implement, do not reconsider

### 1. The limiter counts failures, not requests

The middleware is a gate: it reads the counters and refuses. The route is the
recorder: it increments only when it is about to answer `invalid_credentials`.
A user who signs in successfully is never limited, and the counter holds exactly
what a guesser produces.

`server/src/middleware/loginRateLimit.ts`:

```ts
export const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_RATE_LIMIT_MAX_PER_EMAIL = 5;
export const LOGIN_RATE_LIMIT_MAX_PER_IP = 20;
/** Fail-open bound on the in-memory store, see decision 3. */
export const LOGIN_RATE_LIMIT_MAX_KEYS = 10_000;

/** Refuses the request with 429 `rate_limited` when either counter is full. */
export const loginRateLimit: RequestHandler;

/** Called by the login handler immediately before answering `invalid_credentials`. */
export function recordFailedLogin(request: Request): void;

/** Called by the login handler once the password has been verified. */
export function clearFailedLogins(request: Request): void;

/** Tests only: empties the store. */
export function resetLoginRateLimit(): void;
```

Two independent counters per request, both derived by one internal helper:

- `email:<request.body.email>` — capped at `LOGIN_RATE_LIMIT_MAX_PER_EMAIL`. It
  is the counter that matters: guessing targets one account.
- `ip:<request.ip ?? "unknown">` — capped at `LOGIN_RATE_LIMIT_MAX_PER_IP`. It
  is deliberately four times looser, because an office behind one NAT address is
  a normal shape and a tight IP cap locks out colleagues.

One entry is `{ count: number; expiresAt: number }`. The window is fixed and
starts at the **first** failure of the entry: `recordFailedLogin` creates the
entry with `expiresAt = Date.now() + LOGIN_RATE_LIMIT_WINDOW_MS` and later
failures only raise `count`. An entry whose `expiresAt` has passed counts as
absent and is replaced.

`clearFailedLogins` deletes both entries. The login handler calls it as soon as
the password has been verified, before the `blocked` and `archived` branches —
a correct password is proof that this is not a guesser, whatever the account
status.

Which outcomes count as a failure: exactly the two that answer
`invalid_credentials` — no such user or wrong password, and the archived
account. An account that answers `403 account_blocked` counts as neither: the
password was right, so it is not a guess, but the counters are not cleared
either.

### 2. The refusal

```ts
next(new AppError(429, "rate_limited", `Слишком много попыток входа. Повторите через ${minutes} мин.`));
```

where `minutes = Math.max(1, Math.ceil((expiresAt - Date.now()) / 60_000))` of
the entry that is full (the later `expiresAt` when both are). Before `next`, set
the header on the response:

```ts
response.setHeader("Retry-After", String(Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000))));
```

`errorHandler` does not touch headers set earlier, so it survives. A refusal
does **not** raise any counter — a limited caller must not be able to extend
their own lockout by hammering, and the window ends when it ends.

### 3. The store is in-memory, and its limits are stated, not hidden

A `Map` at module scope. On every `loginRateLimit` call, first sweep entries
whose `expiresAt` has passed. If the map still holds more than
`LOGIN_RATE_LIMIT_MAX_KEYS` entries after the sweep, clear it entirely and let
requests through: an unbounded map is a memory-exhaustion hole, and failing open
on an MVP single process is the smaller loss.

Write these three consequences as a comment at the top of the file, because they
are what the defence asks about: the counters live in one process and do not
survive a restart; several server processes would each hold their own; the
distributed answer is a shared store, which this project does not have.

### 4. Same cost for an unknown email

In `server/src/auth/password.ts` add:

```ts
/**
 * A hash to compare against when no account was found, so that an unknown
 * address costs the same bcrypt comparison as a wrong password. Computed once
 * per process from a random value nobody holds: the comparison can only fail.
 */
export function unknownAccountPasswordHash(): Promise<string>;
```

Memoise the promise in a module-level `let` and build it with
`hashPassword(randomBytes(32).toString("hex"))` (`node:crypto`). The cost factor
matches `PASSWORD_SALT_ROUNDS` because `hashPassword` is what makes it, so the
comparison takes the same time as a real one.

In the login handler, remove the short circuit:

```ts
const user = await User.findOne({ email: body.email }).select("+passwordHash");
const passwordHash = user?.passwordHash ?? (await unknownAccountPasswordHash());
const isPasswordValid = await verifyPassword(body.password, passwordHash);

if (!user || !isPasswordValid) {
  recordFailedLogin(request);
  next(invalidCredentials());
  return;
}

clearFailedLogins(request);
```

`INVALID_CREDENTIALS` becomes a factory:

```ts
function invalidCredentials(): AppError {
  return new AppError(401, "invalid_credentials", "Неверный email или пароль");
}
```

One shared `Error` instance across every request of a process carries one stack
trace and one mutable object; a factory costs nothing and ends the sharing. Use
it in both branches that answer it — the failed check above and the archived
account below, which also calls `recordFailedLogin`.

### 5. The breakdown in the contract

In `shared/src/tests.ts`, replace the comment above `attemptResultSchema` that
says the breakdown is not in the contract, and add before it:

```ts
/**
 * Разбор одного вопроса после отправки попытки (ТЗ, 18.2). Строится из снимка
 * вопросов попытки (8.7): правильность известна серверу и раскрывается только
 * после отправки (10.3), в ответе на саму попытку.
 */
export const attemptReviewOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
  isCorrect: z.boolean(),
  isSelected: z.boolean(),
});
export type AttemptReviewOption = z.infer<typeof attemptReviewOptionSchema>;

export const attemptReviewQuestionSchema = z.object({
  questionId: z.string(),
  text: z.string(),
  type: questionTypeSchema,
  order: z.number().int(),
  isCorrect: z.boolean(),
  options: z.array(attemptReviewOptionSchema),
});
export type AttemptReviewQuestion = z.infer<typeof attemptReviewQuestionSchema>;
```

and extend `attemptResultSchema` with one **required** field:

```ts
  review: z.array(attemptReviewQuestionSchema),
```

Required, not optional: the contract is the single source of truth, both halves
land in this slice, and an optional field would leave the client branching on a
shape that never arrives.

No new endpoint. Specification 18.2 asks for the breakdown «после отправки
теста», and this is that response; re-reading a past attempt is not in scope.

### 6. The client fixture

`client/src/features/learning/learningSlice.test.ts:24` builds its fixture with
`attemptResultSchema.parse({...})`, which now throws for a missing `review`. Add
`review: []` to that object literal and change nothing else under `client/`. An
empty array is a legal attempt result here — the fixture tests the reducer, not
the breakdown.

### 7. Building the breakdown

In `server/src/learning/attemptScoring.ts`:

```ts
export function buildAttemptReview(
  snapshot: AttemptQuestionSnapshot[],
  answers: AttemptAnswer[],
): AttemptReviewQuestion[];
```

- Walk `snapshot` in its stored order. `buildQuestionsSnapshot` already sorted
  it by `order`, so the breakdown reads in the order the learner saw.
- Selected options come from a `Map` over `answers`; a question missing from
  `answers` is an unanswered question, an empty set.
- Each option maps to `{ id: option.optionId, text: option.text, isCorrect:
  option.isCorrect, isSelected: selected.includes(option.optionId) }`.
- The question's `isCorrect` is `isQuestionCorrect(question, selected)`. Reuse
  it. Do not compare sets a second time here — one rule in one place, and no way
  for the screen and the score to disagree.

One artefact worth knowing and leaving alone: an `optionId` that belongs to no
option is kept in `answers` on purpose (it is what makes the answer wrong), and
it appears in no option row, so such a question reads as wrong while every
visible selection looks right. That takes a hand-made request; the UI cannot
produce it.

In `server/src/routes/learningTests.ts`, add to the response object:

```ts
        review: buildAttemptReview(questionsSnapshot, graded.answers),
```

built from the in-memory snapshot and the graded answers — the same values that
were just written — not from a re-read of the document.

### 8. Resetting the limiter between tests

In `server/src/testing/apiClient.ts`, call `resetLoginRateLimit()` at the top of
`clearDatabase()`, with a one-line comment saying why it lives there: every
suite already calls `clearDatabase` in `beforeEach`, and the limiter is process
state that outlives a collection drop, so one suite with a few failed logins
would otherwise poison the next.

## Tests

`server/src/middleware/loginRateLimit.test.ts` — the store, without HTTP:

- five failures on one email, then the sixth request is refused;
- a different email is not refused while the first is blocked;
- `clearFailedLogins` after four failures lets four more through;
- the window expires: with `vi.useFakeTimers()`, advance past
  `LOGIN_RATE_LIMIT_WINDOW_MS` and the next request passes.

`server/src/routes/auth.test.ts` — over HTTP:

- six wrong passwords on one account: the sixth answers `429` with code
  `rate_limited` and a `Retry-After` header;
- a correct password after four wrong ones signs in and clears the counter —
  four more wrong ones still answer `401`, not `429`.

Do **not** assert wall-clock durations anywhere. The timing fix of decision 4 is
verified by reading the handler, and a timing assertion on bcrypt is a flaky
test that fails on someone else's machine. Say in the self-report that you
verified it by reading, and quote the lines.

`server/src/learning/attemptScoring.test.ts` — `buildAttemptReview`:

- an all-correct attempt: every question `isCorrect`, the selected options are
  exactly the correct ones;
- a partly wrong attempt: the wrong question carries `isCorrect: false` and its
  correct option is present with `isCorrect: true, isSelected: false`;
- an unanswered question: no option `isSelected`, the question `isCorrect: false`;
- a stray unknown `optionId`: no option row for it, the question `isCorrect: false`.

`server/src/routes/learningTests.test.ts`:

- the attempt response carries `review` with one entry per question in `order`
  and the correct flags;
- `GET /api/learning/tests/:testId` still carries no correctness — assert
  `JSON.stringify(response.body)` does not contain `"isCorrect"`.

## Gate

From the repository root, in this order:

```
npm run build && npm run typecheck && npm run lint && npm run test
```

`shared/` must be rebuilt before the other two workspaces type-check — you
changed its schemas. Do not open a browser; the checklist for the developer goes
in the self-report.

## Self-report

`.codex/reports/slice-13-server.md`, in the format of `AGENTS.md` (8). Section 5
— «claim → check → result», one line per claim, including the ones that held —
is mandatory and must cover at least:

- the limiter refuses only after the cap and only on failures;
- an unknown email and a wrong password take the same code path through
  `verifyPassword`;
- `GET /learning/tests/:testId` still hides correctness;
- `review` agrees with the score: a question that is `isCorrect` in the
  breakdown is one of the `correctCount`.

End with a manual checklist for the developer: what to click, what to expect.
Then stop. One commit, no push, no amend.
