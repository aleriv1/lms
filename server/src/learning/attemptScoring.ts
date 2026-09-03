import type { SubmitAttemptBody } from "@lms/shared";

import type { QuestionAttributes } from "../models/Test.js";
import type {
  AttemptAnswer,
  AttemptQuestionSnapshot,
} from "../models/TestAttempt.js";

/**
 * Scoring rules of specification 4.4, as pure functions over one test. Nothing
 * here reads the database: the handler passes the test's questions and the
 * submitted body, and gets back the snapshot, the normalised answers and the
 * result. This is the part of the slice nobody can see by looking at a screen,
 * so it is the part that is unit-tested.
 */

/**
 * The questions as they stood at the moment of submission (specification 7.17).
 * Everything is graded against this copy and not against the live document, so
 * one edit landing between two lines of the handler cannot split the result.
 */
export function buildQuestionsSnapshot(
  questions: QuestionAttributes[],
): AttemptQuestionSnapshot[] {
  return [...questions]
    .sort((first, second) => first.order - second.order)
    .map((question) => ({
      questionId: question._id.toString(),
      text: question.text,
      type: question.type,
      order: question.order,
      options: question.options.map((option) => ({
        optionId: option._id.toString(),
        text: option.text,
        isCorrect: option.isCorrect,
      })),
    }));
}

/**
 * `submitAttemptBodySchema` checks almost nothing — an empty `answers`, a
 * repeated `questionId` and a repeated option are all valid input — so the four
 * rules live here:
 *
 * 1. An answer to an unknown question is dropped: the question may have been
 *    deleted while the learner was answering.
 * 2. A repeated `questionId` keeps the last entry — what an object built from
 *    the array would hold.
 * 3. Repeats inside `optionIds` collapse; the order carries no meaning.
 * 4. An option that belongs to no question is *kept*. It makes the selected set
 *    differ from the correct one, which is exactly what it should do; dropping
 *    it would repair a wrong answer into a right one.
 *
 * A question missing from `answers` is a question left unanswered — an empty
 * set, which never equals a non-empty set of correct options. Specification 7.7
 * expects unanswered questions and asks the client to warn about them, not the
 * server to refuse them.
 */
export function normalizeAnswers(
  snapshot: AttemptQuestionSnapshot[],
  answers: SubmitAttemptBody["answers"],
): AttemptAnswer[] {
  const known = new Set(snapshot.map((question) => question.questionId));
  const byQuestionId = new Map<string, string[]>();

  for (const answer of answers) {
    if (!known.has(answer.questionId)) {
      continue;
    }

    byQuestionId.set(answer.questionId, [...new Set(answer.optionIds)]);
  }

  // Ordered by the snapshot, so the stored attempt reads in the order the
  // learner saw the questions in.
  return snapshot
    .filter((question) => byQuestionId.has(question.questionId))
    .map((question) => ({
      questionId: question.questionId,
      optionIds: byQuestionId.get(question.questionId) ?? [],
    }));
}

function isSameSet(selected: string[], correct: string[]): boolean {
  if (selected.length !== correct.length) {
    return false;
  }

  const correctSet = new Set(correct);

  return selected.every((optionId) => correctSet.has(optionId));
}

/**
 * One rule for both question types: a question counts only when the set of
 * selected options equals the set of correct ones. For `multiple` that is
 * specification 4.4 word for word — no partial credit. For `single` the correct
 * option is exactly one (4.4, enforced by `questionInputSchema`), so the same
 * rule reads "that one option and nothing else": two selections on a
 * single-answer question are not half a point, they are a miss.
 *
 * There is no branch on `question.type` here, and that is the strongest
 * guarantee against partial credit available — there is nowhere to award it.
 */
export function isQuestionCorrect(
  question: AttemptQuestionSnapshot,
  selectedOptionIds: string[],
): boolean {
  const correct = question.options
    .filter((option) => option.isCorrect)
    .map((option) => option.optionId);

  return isSameSet(selectedOptionIds, correct);
}

export type AttemptScore = {
  answers: AttemptAnswer[];
  correctCount: number;
  totalCount: number;
  score: number;
  passed: boolean;
};

/**
 * The result of one submission. The score is the share of correct answers as a
 * whole percentage (specification 4.4); `Math.round` is mandatory, because
 * `percentSchema` rejects anything but an integer.
 *
 * The passing score is compared loosely: specification 4.4 calls it a passing
 * score, not a threshold to exceed, so hitting it exactly passes.
 */
export function gradeAttempt(
  snapshot: AttemptQuestionSnapshot[],
  submitted: SubmitAttemptBody["answers"],
  passingScore: number,
): AttemptScore {
  const answers = normalizeAnswers(snapshot, submitted);
  const selectedByQuestionId = new Map(
    answers.map((answer) => [answer.questionId, answer.optionIds]),
  );

  const correctCount = snapshot.filter((question) =>
    isQuestionCorrect(
      question,
      selectedByQuestionId.get(question.questionId) ?? [],
    ),
  ).length;

  const totalCount = snapshot.length;
  // A test without questions cannot be created (`TEST_QUESTIONS_MIN_COUNT`),
  // but a zero denominator would yield `NaN`, and `NaN` leaves through
  // `percentSchema` as a 500 rather than as a zero.
  const score =
    totalCount === 0 ? 0 : Math.round((correctCount / totalCount) * 100);

  return {
    answers,
    correctCount,
    totalCount,
    score,
    passed: score >= passingScore,
  };
}
