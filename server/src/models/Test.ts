import {
  QUESTION_TYPES,
  type Question as QuestionResponse,
  type QuestionType,
  type Test as TestResponse,
  type TestSummary,
} from "@lms/shared";
import { type HydratedDocument, model, Schema, type Types } from "mongoose";

export type QuestionOptionAttributes = {
  _id: Types.ObjectId;
  text: string;
  isCorrect: boolean;
};

export type QuestionAttributes = {
  _id: Types.ObjectId;
  text: string;
  type: QuestionType;
  order: number;
  options: QuestionOptionAttributes[];
};

export type TestAttributes = {
  courseId: Types.ObjectId;
  lessonId: Types.ObjectId | null;
  title: string;
  passingScore: number;
  version: number;
  questions: QuestionAttributes[];
  createdAt: Date;
  updatedAt: Date;
};

export type TestDocument = HydratedDocument<TestAttributes>;

/** A test as it comes back from a lean read: no document methods, plain `_id`. */
export type TestRecord = TestAttributes & { _id: Types.ObjectId };

// Specification 8.4 names an identifier for the question and for every option,
// and an attempt will refer to them (slice 08), so unlike `resourceLinks` of a
// lesson these subdocuments keep their `_id`.
const questionOptionSchema = new Schema<QuestionOptionAttributes>({
  text: { type: String, required: true, trim: true },
  isCorrect: { type: Boolean, required: true },
});

const questionSchema = new Schema<QuestionAttributes>({
  text: { type: String, required: true, trim: true },
  type: { type: String, enum: QUESTION_TYPES, required: true },
  order: { type: Number, required: true },
  options: { type: [questionOptionSchema], required: true },
});

const testSchema = new Schema<TestAttributes>(
  {
    courseId: { type: Schema.Types.ObjectId, required: true, ref: "Course" },
    lessonId: { type: Schema.Types.ObjectId, default: null, ref: "Lesson" },
    title: { type: String, required: true, trim: true },
    passingScore: { type: Number, required: true },
    version: { type: Number, default: 1 },
    questions: { type: [questionSchema], required: true },
  },
  { timestamps: true },
);

// Serves the course composition and the count of tests.
testSchema.index({ courseId: 1 });
// A lesson has at most one test. The filter selects by type and not by
// `$exists`, because `lessonId` has `default: null` and therefore always
// exists — `$exists` would drag the final tests of every course into the
// index and make them collide with each other.
testSchema.index(
  { lessonId: 1 },
  { unique: true, partialFilterExpression: { lessonId: { $type: "objectId" } } },
);

export const Test = model<TestAttributes>("Test", testSchema);

function sortedQuestions(test: TestRecord): QuestionAttributes[] {
  return [...test.questions].sort((first, second) => first.order - second.order);
}

export function toTestSummary(test: TestRecord): TestSummary {
  return {
    id: test._id.toString(),
    title: test.title,
    lessonId: test.lessonId ? test.lessonId.toString() : null,
    passingScore: test.passingScore,
    questionsCount: test.questions.length,
    version: test.version,
  };
}

/**
 * The administrative view of specification 8.4: it carries `isCorrect`, so it
 * is returned only from the teacher and administrator routes.
 */
export function toTest(test: TestRecord): TestResponse {
  return {
    ...toTestSummary(test),
    courseId: test.courseId.toString(),
    questions: sortedQuestions(test).map(
      (question): QuestionResponse => ({
        id: question._id.toString(),
        text: question.text,
        type: question.type,
        order: question.order,
        options: question.options.map((option) => ({
          id: option._id.toString(),
          text: option.text,
          isCorrect: option.isCorrect,
        })),
      }),
    ),
    createdAt: test.createdAt.toISOString(),
    updatedAt: test.updatedAt.toISOString(),
  };
}
