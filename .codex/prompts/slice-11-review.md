# Slice 11 — layer-2 review, by a session that did not write it

Read `AGENTS.md` first. You are not the author here: slice 11 was committed as
`6210d40` by another session. Judge it, do not defend it.

A test suite is the one artefact whose quality is checkable by machine: break
the code it claims to cover, and it must go red. That is most of this review.

## 1. Mutation check — the main job

For each mutation below: apply it, run **only** the test file named, record
whether it failed and which test failed, then **restore the file exactly**
(`git checkout -- <file>`). Never commit a mutation.

| # | File and change | Must fail |
|---|---|---|
| 1 | `routes/auth.ts` — let a `blocked` user sign in | `auth.test.ts` |
| 2 | `routes/auth.ts` — answer an unknown email with a different `code` than a wrong password | `auth.test.ts` |
| 3 | `middleware/requireRole.ts` — let any authenticated role through | `roleAccess.test.ts` |
| 4 | `routes/courses.ts` — allow deleting a published course | `courses.test.ts` |
| 5 | `routes/userAssignments.ts` — allow a second active assignment on the same pair | `userAssignments.test.ts` |
| 6 | `learning/accessRules.ts` — treat a `revoked` assignment as effective | `learningAccess.test.ts` |
| 7 | `learning/lessonStates.ts` — make every lesson `available` | `learningAccess.test.ts` |
| 8 | `learning/attemptScoring.ts` — pass a question when *any* correct option is selected | `learningTests.test.ts` |
| 9 | `routes/learningTests.ts` — always write `attemptNumber: 1` | `learningTests.test.ts` |
| 10 | `routes/learningTests.ts` — include `isCorrect` in the learner's test view | `learningTests.test.ts` |

**A mutation that leaves the suite green is the finding.** Say which assertion
was missing and add the one test that catches it — that is the only code you
write in this review, and it goes in the file that should have had it.

Two mutations are already done and both bit: removing the two `deleteMany` of
the draft-course cascade (`courses.test.ts` failed), and making the test loader
ignore `intent` so an archived course accepts a submission
(`learningTests.test.ts` failed). Do not repeat those two.

## 2. Read the suite for the three ways a test lies

- **Asserts the response it just received** rather than a fixed expectation
  (`expect(body.code).toBe(body.code)`, snapshots of live output, `toBeDefined`
  where a value was meant).
- **Never reaches the assertion**: a request that already failed, an `await`
  missing, a `beforeEach` that leaves the fixture absent, an `expect` inside a
  callback that never runs.
- **Passes for the wrong reason**: a 403 that is really a 401 because the sign-in
  silently failed; a count that is zero because nothing was ever created.

## 3. Check the harness

`server/src/testing/apiClient.ts`: the `-test` suffix guard must run before any
write and must actually throw — prove it by pointing `MONGODB_URI` at a
database named without the suffix and running one file. Confirm `clearDatabase`
empties all seven collections. Confirm the suite does not depend on the seed.

## 4. Coverage against specification 13

The report claims a mapping from each line of specification 13 to test names.
Verify it line by line: open each named test and confirm it asserts what the
line says. A line covered only by a name is not covered.

## Verification

MongoDB must be running (`npm run db:up`). At the end, on the restored tree:

```
npm run typecheck && npm run lint && npm run build && npm run test
```

## Hand over

Write `.codex/reports/slice-11-review.md`: the mutation table with what
actually happened per row, the lies found by reading, the harness result, the
specification 13 mapping verdict, and a one-line verdict — closed or not.
`git status` must show only your report and any test you added. Commit once,
do not push, and stop.
