import { QUESTION_TYPES, type QuestionType } from "@lms/shared";
import { type HydratedDocument, model, Schema, type Types } from "mongoose";

/**
 * One submitted attempt (specification 8.7). An attempt is a finished record:
 * nothing edits it afterwards, and specification 7.17 requires that editing the
 * test must not change it — hence `questionsSnapshot`, the questions, options
 * and correct flags as they stood at the moment of submission.
 */

export type AttemptOptionSnapshot = {
  optionId: string;
  text: string;
  isCorrect: boolean;
};

export type AttemptQuestionSnapshot = {
  questionId: string;
  text: string;
  type: QuestionType;
  order: number;
  options: AttemptOptionSnapshot[];
};

export type AttemptAnswer = {
  questionId: string;
  optionIds: string[];
};

export type TestAttemptAttributes = {
  userId: Types.ObjectId;
  testId: Types.ObjectId;
  courseId: Types.ObjectId;
  lessonId: Types.ObjectId | null;
  /** Reference only (specification 7.17): past attempts are restored from the
   * snapshot, never by replaying a version. */
  testVersion: number;
  questionsSnapshot: AttemptQuestionSnapshot[];
  answers: AttemptAnswer[];
  correctCount: number;
  totalCount: number;
  score: number;
  passed: boolean;
  attemptNumber: number;
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type TestAttemptDocument = HydratedDocument<TestAttemptAttributes>;

/**
 * Identifiers inside the attempt are strings, while the four references above
 * are `ObjectId`. Three reasons, each sufficient on its own:
 *
 * - `answers[].optionIds` arrives from the request body as `z.string()`
 *   (`submitAttemptBodySchema`). An option identifier that belongs to no
 *   question is deliberately kept — it makes the answer wrong rather than
 *   disappearing — and casting it to `ObjectId` would throw on `save()`
 *   instead of scoring a zero.
 * - The snapshot is a photograph, not a reference. Nothing joins on it: the
 *   detailed answer breakdown of stage 2 reads the snapshot itself, and a
 *   question deleted from the test must leave the attempt intact.
 * - Mongoose gives subdocuments an `_id` of their own, which next to
 *   `questionId` would be a second column of identifiers meaning nothing.
 */
const attemptOptionSchema = new Schema<AttemptOptionSnapshot>(
  {
    optionId: { type: String, required: true },
    text: { type: String, required: true },
    isCorrect: { type: Boolean, required: true },
  },
  { _id: false },
);

const attemptQuestionSchema = new Schema<AttemptQuestionSnapshot>(
  {
    questionId: { type: String, required: true },
    text: { type: String, required: true },
    type: { type: String, enum: QUESTION_TYPES, required: true },
    order: { type: Number, required: true },
    options: { type: [attemptOptionSchema], required: true },
  },
  { _id: false },
);

const attemptAnswerSchema = new Schema<AttemptAnswer>(
  {
    questionId: { type: String, required: true },
    optionIds: { type: [String], required: true },
  },
  { _id: false },
);

const testAttemptSchema = new Schema<TestAttemptAttributes>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    testId: { type: Schema.Types.ObjectId, required: true, ref: "Test" },
    // Both are copied from the test rather than looked up later: the attempt
    // has to keep saying which course and lesson it belonged to even after the
    // test is reattached elsewhere.
    courseId: { type: Schema.Types.ObjectId, required: true, ref: "Course" },
    lessonId: { type: Schema.Types.ObjectId, default: null, ref: "Lesson" },
    testVersion: { type: Number, required: true },
    questionsSnapshot: { type: [attemptQuestionSchema], required: true },
    answers: { type: [attemptAnswerSchema], required: true },
    correctCount: { type: Number, required: true },
    totalCount: { type: Number, required: true },
    score: { type: Number, required: true },
    passed: { type: Boolean, required: true },
    attemptNumber: { type: Number, required: true },
    submittedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

/**
 * The attempt number is counted before the write, and this index is the only
 * thing that closes the window between counting and writing. It also serves
 * every read of the slice: the learner's statistics for one test match on the
 * `userId + testId` prefix.
 */
testAttemptSchema.index(
  { userId: 1, testId: 1, attemptNumber: 1 },
  { unique: true },
);

export const TestAttempt = model<TestAttemptAttributes>(
  "TestAttempt",
  testAttemptSchema,
);
