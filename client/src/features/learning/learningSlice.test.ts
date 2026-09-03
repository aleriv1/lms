import {
  attemptResultSchema,
  learningCourseSchema,
  learningLessonSchema,
  lessonProgressResponseSchema,
} from "@lms/shared";
import { describe, expect, it } from "vitest";

import {
  clearAttemptResult,
  completeLesson,
  fetchLearningCourse,
  fetchLearningLesson,
  learningReducer,
  startLesson,
  submitAttempt,
} from "./learningSlice";

const courseId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const lessonId = "bbbbbbbbbbbbbbbbbbbbbbbb";
const optionalId = "cccccccccccccccccccccccc";
const neighbourId = "dddddddddddddddddddddddd";

const attempt = attemptResultSchema.parse({
  id: "ffffffffffffffffffffffff",
  testId: "eeeeeeeeeeeeeeeeeeeeeeee",
  courseId,
  lessonId,
  score: 67,
  passingScore: 70,
  passed: false,
  correctCount: 2,
  totalCount: 3,
  attemptNumber: 4,
  submittedAt: "2026-09-03T10:00:00.000Z",
});

const course = learningCourseSchema.parse({
  id: courseId,
  title: "Курс",
  shortDescription: "Описание",
  description: "Материалы курса",
  category: "Эксплуатация",
  audience: "general",
  coverUrl: null,
  author: { id: "eeeeeeeeeeeeeeeeeeeeeeee", name: "Автор" },
  courseStatus: "published",
  assignmentStatus: "active",
  progressPercent: 0,
  lessons: [
    {
      id: lessonId,
      title: "Первый",
      order: 1,
      durationMinutes: 10,
      isRequired: true,
      state: "available",
      hasTest: false,
    },
    {
      id: optionalId,
      title: "Необязательный",
      order: 2,
      durationMinutes: 5,
      isRequired: false,
      state: "available",
      hasTest: true,
    },
    {
      id: neighbourId,
      title: "Следующий",
      order: 3,
      durationMinutes: 15,
      isRequired: true,
      state: "locked",
      hasTest: false,
    },
  ],
  finalTest: null,
  nextLessonId: lessonId,
});

const lesson = learningLessonSchema.parse({
  id: lessonId,
  courseId,
  title: "Первый",
  order: 1,
  durationMinutes: 10,
  isRequired: true,
  content: "<p>Материал</p>",
  videoUrl: null,
  resourceLinks: [],
  progressStatus: "not_started",
  requiredTest: null,
  previousLessonId: null,
  nextLessonId: optionalId,
  courseProgressPercent: 0,
});

function loadedState() {
  const state = learningReducer(
    undefined,
    fetchLearningCourse.fulfilled(course, "course", courseId),
  );
  return learningReducer(
    state,
    fetchLearningLesson.fulfilled(lesson, "lesson", { courseId, lessonId }),
  );
}

describe("learning cache", () => {
  it("stores the server attempt result without rewriting course or lesson state", () => {
    const state = loadedState();
    const result = learningReducer(
      state,
      submitAttempt.fulfilled(attempt, "attempt", {
        testId: attempt.testId,
        body: { answers: [] },
      }),
    );
    expect(result.attempt.data).toEqual(attempt);
    expect(result.course).toEqual(state.course);
    expect(result.lesson).toEqual(state.lesson);
  });

  it("clears the result for a new empty form without discarding learning data", () => {
    const state = learningReducer(
      loadedState(),
      submitAttempt.fulfilled(attempt, "attempt", {
        testId: attempt.testId,
        body: { answers: [] },
      }),
    );
    expect(learningReducer(state, clearAttemptResult())).toEqual({
      ...state,
      attempt: { data: null },
    });
  });

  it("keeps the loaded material and TOC during refresh, including uppercase URLs", () => {
    let state = loadedState();
    state = learningReducer(
      state,
      fetchLearningCourse.pending("refresh-course", courseId.toUpperCase()),
    );
    state = learningReducer(
      state,
      fetchLearningLesson.pending("refresh-lesson", {
        courseId: courseId.toUpperCase(),
        lessonId: lessonId.toUpperCase(),
      }),
    );

    expect(state.course.data).toEqual(course);
    expect(state.lesson.data).toEqual(lesson);
    expect(state.course.status).toBe("loading");
    expect(state.lesson.status).toBe("loading");
  });

  it("does not show the previous entity while a different URL loads", () => {
    const state = loadedState();
    expect(
      learningReducer(
        state,
        fetchLearningCourse.pending("other-course", optionalId),
      ).course.data,
    ).toBeNull();
    expect(
      learningReducer(
        state,
        fetchLearningLesson.pending("other-lesson", {
          courseId,
          lessonId: optionalId,
        }),
      ).lesson.data,
    ).toBeNull();
    expect(
      learningReducer(
        state,
        fetchLearningLesson.pending("wrong-course", {
          courseId: optionalId,
          lessonId,
        }),
      ).lesson.data,
    ).toBeNull();
  });

  it.each([startLesson.fulfilled, completeLesson.fulfilled])(
    "writes server progress without replacing neighbours or guessing access states (%s)",
    (fulfilled) => {
      const progress = lessonProgressResponseSchema.parse({
        lessonId,
        courseId,
        status: "completed",
        courseProgressPercent: 37,
        courseCompleted: false,
        nextLessonId: neighbourId,
      });
      const state = learningReducer(
        loadedState(),
        fulfilled(progress, "action", lessonId),
      );

      expect(state.lesson.data?.progressStatus).toBe("completed");
      expect(state.course.data?.progressPercent).toBe(37);
      expect(state.lesson.data?.courseProgressPercent).toBe(37);
      expect(state.course.data?.nextLessonId).toBe(neighbourId);
      expect(state.lesson.data?.nextLessonId).toBe(optionalId);
      expect(state.lesson.data?.previousLessonId).toBeNull();
      expect(state.course.data?.lessons).toEqual(course.lessons);
      expect(state.course.data?.assignmentStatus).toBe("active");

      const refreshed = {
        ...course,
        lessons: course.lessons.map((item) => ({
          ...item,
          state: "available" as const,
        })),
      };
      expect(
        learningReducer(
          state,
          fetchLearningCourse.fulfilled(refreshed, "refresh", courseId),
        ).course.data,
      ).toEqual(refreshed);
    },
  );

  it("keeps a failed automatic start silent and retains the readable lesson", () => {
    const state = loadedState();
    const rejected = startLesson.rejected(null, "start", lessonId, {
      code: "forbidden",
      message: "Курс архивирован: новые действия по нему недоступны",
    });
    expect(learningReducer(state, rejected)).toEqual(state);
  });

  it("keeps a locked direct URL refusal available by its code", () => {
    const state = learningReducer(
      loadedState(),
      fetchLearningLesson.pending("locked", {
        courseId,
        lessonId: neighbourId,
      }),
    );
    const error = {
      code: "lesson_locked" as const,
      message: "Урок откроется после завершения предыдущего",
    };
    const result = learningReducer(
      state,
      fetchLearningLesson.rejected(
        null,
        "locked",
        { courseId, lessonId: neighbourId },
        error,
      ),
    );
    expect(result.lesson.data).toBeNull();
    expect(result.lesson.status).toBe("error");
    expect(result.lesson.error).toEqual(error);
  });

  it("ignores an aborted read when leaving the previous lesson", () => {
    const state = loadedState();
    const aborted = fetchLearningLesson.rejected(
      { name: "AbortError", message: "Aborted" },
      "old",
      { courseId, lessonId },
    );
    expect(learningReducer(state, aborted)).toEqual(state);
  });

  it("does not apply an action from another course to the current one", () => {
    const state = loadedState();
    const progress = lessonProgressResponseSchema.parse({
      lessonId: optionalId,
      courseId: neighbourId,
      status: "completed",
      courseProgressPercent: 100,
      courseCompleted: true,
      nextLessonId: null,
    });
    expect(
      learningReducer(
        state,
        completeLesson.fulfilled(progress, "old-course", optionalId),
      ),
    ).toEqual(state);
  });
});
