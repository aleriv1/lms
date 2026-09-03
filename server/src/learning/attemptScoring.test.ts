import { Types } from "mongoose";
import { describe, expect, it } from "vitest";

import {
  buildQuestionsSnapshot,
  gradeAttempt,
  normalizeAnswers,
} from "./attemptScoring.js";
import type { QuestionAttributes } from "../models/Test.js";
import type { AttemptQuestionSnapshot } from "../models/TestAttempt.js";

/**
 * The scoring of specification 4.4. Nothing here can be seen on a screen: a
 * wrong rule shows a plausible number, so these are the tests that stand
 * between the project and partial credit.
 */

function option(
  id: string,
  isCorrect: boolean,
): AttemptQuestionSnapshot["options"][number] {
  return { optionId: id, text: id, isCorrect };
}

function question(
  id: string,
  type: "single" | "multiple",
  options: AttemptQuestionSnapshot["options"],
  order = 1,
): AttemptQuestionSnapshot {
  return { questionId: id, text: id, type, order, options };
}

const single = question("q1", "single", [
  option("a", true),
  option("b", false),
  option("c", false),
]);

const multiple = question(
  "q2",
  "multiple",
  [option("x", true), option("y", true), option("z", false)],
  2,
);

describe("gradeAttempt", () => {
  it("counts a single-answer question only for the correct option", () => {
    expect(
      gradeAttempt([single], [{ questionId: "q1", optionIds: ["a"] }], 70).score,
    ).toBe(100);
    expect(
      gradeAttempt([single], [{ questionId: "q1", optionIds: ["b"] }], 70).score,
    ).toBe(0);
  });

  it("refuses a single-answer question with two options selected", () => {
    // Not half a point: the selected set differs from the correct one.
    const graded = gradeAttempt(
      [single],
      [{ questionId: "q1", optionIds: ["a", "b"] }],
      70,
    );

    expect(graded.correctCount).toBe(0);
  });

  it("counts a multiple-answer question only on an exact match", () => {
    const exact = gradeAttempt(
      [multiple],
      [{ questionId: "q2", optionIds: ["x", "y"] }],
      70,
    );
    const subset = gradeAttempt(
      [multiple],
      [{ questionId: "q2", optionIds: ["x"] }],
      70,
    );
    const superset = gradeAttempt(
      [multiple],
      [{ questionId: "q2", optionIds: ["x", "y", "z"] }],
      70,
    );

    expect(exact.correctCount).toBe(1);
    expect(subset.correctCount).toBe(0);
    expect(superset.correctCount).toBe(0);
  });

  it("counts an unanswered question as wrong and keeps it in the total", () => {
    const graded = gradeAttempt(
      [single, multiple],
      [{ questionId: "q1", optionIds: ["a"] }],
      70,
    );

    expect(graded).toMatchObject({
      correctCount: 1,
      totalCount: 2,
      score: 50,
      passed: false,
    });
  });

  it("scores an empty submission as zero", () => {
    expect(gradeAttempt([single, multiple], [], 70)).toMatchObject({
      correctCount: 0,
      totalCount: 2,
      score: 0,
      passed: false,
    });
  });

  it("ignores an answer to a question the test does not have", () => {
    const graded = gradeAttempt(
      [single],
      [
        { questionId: "q1", optionIds: ["a"] },
        { questionId: "deleted", optionIds: ["a"] },
      ],
      70,
    );

    expect(graded).toMatchObject({ correctCount: 1, totalCount: 1 });
    expect(graded.answers).toHaveLength(1);
  });

  it("keeps the last entry when one question is answered twice", () => {
    const graded = gradeAttempt(
      [single],
      [
        { questionId: "q1", optionIds: ["a"] },
        { questionId: "q1", optionIds: ["b"] },
      ],
      70,
    );

    expect(graded.correctCount).toBe(0);
  });

  it("collapses a repeated option", () => {
    const graded = gradeAttempt(
      [single],
      [{ questionId: "q1", optionIds: ["a", "a"] }],
      70,
    );

    expect(graded.correctCount).toBe(1);
    expect(graded.answers[0]?.optionIds).toEqual(["a"]);
  });

  it("counts an option that belongs to no question as a wrong answer", () => {
    // Filtering it out would repair a wrong answer into a right one.
    const graded = gradeAttempt(
      [single],
      [{ questionId: "q1", optionIds: ["a", "unknown"] }],
      70,
    );

    expect(graded.correctCount).toBe(0);
  });

  it("rounds the score to a whole percentage", () => {
    const third = question("q3", "single", [option("m", true)], 3);
    const graded = gradeAttempt(
      [single, multiple, third],
      [
        { questionId: "q1", optionIds: ["a"] },
        { questionId: "q2", optionIds: ["x", "y"] },
      ],
      70,
    );

    expect(graded.score).toBe(67);
  });

  it("passes on exactly the passing score", () => {
    const graded = gradeAttempt(
      [single, multiple],
      [{ questionId: "q1", optionIds: ["a"] }],
      50,
    );

    expect(graded).toMatchObject({ score: 50, passed: true });
  });
});

describe("normalizeAnswers", () => {
  it("stores answers in the order of the snapshot", () => {
    const answers = normalizeAnswers(
      [single, multiple],
      [
        { questionId: "q2", optionIds: ["x"] },
        { questionId: "q1", optionIds: ["a"] },
      ],
    );

    expect(answers.map((answer) => answer.questionId)).toEqual(["q1", "q2"]);
  });
});

describe("buildQuestionsSnapshot", () => {
  it("sorts by order and keeps the correct flags", () => {
    const second: QuestionAttributes = {
      _id: new Types.ObjectId(),
      text: "second",
      type: "single",
      order: 2,
      options: [
        { _id: new Types.ObjectId(), text: "no", isCorrect: false },
        { _id: new Types.ObjectId(), text: "yes", isCorrect: true },
      ],
    };
    const first: QuestionAttributes = {
      _id: new Types.ObjectId(),
      text: "first",
      type: "multiple",
      order: 1,
      options: [{ _id: new Types.ObjectId(), text: "yes", isCorrect: true }],
    };

    const snapshot = buildQuestionsSnapshot([second, first]);

    expect(snapshot.map((item) => item.text)).toEqual(["first", "second"]);
    expect(snapshot[1]?.options.map((item) => item.isCorrect)).toEqual([
      false,
      true,
    ]);
    expect(snapshot[0]?.questionId).toBe(first._id.toString());
  });
});
