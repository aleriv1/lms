import type { LessonAccessState, LessonProgressStatus } from "@lms/shared";

/**
 * The access rules of specification 4.2 and the progress formula of 4.3, as
 * pure functions over the published lessons of one course. Nothing here reads
 * the database: the caller loads the lessons and the learner's progress once,
 * and every learning screen is derived from the same computation.
 *
 * Only published lessons are ever passed in. A draft lesson is invisible to the
 * learner, does not count and cannot be opened; the progress stored for a
 * lesson that was unpublished stays in the database and simply stops taking
 * part until the lesson is published again (specification 4.2).
 */

export type LearnerLesson = {
  id: string;
  order: number;
  isRequired: boolean;
  progressStatus: LessonProgressStatus;
};

export type LearnerLessonState = LearnerLesson & {
  state: LessonAccessState;
};

function byOrder(first: LearnerLesson, second: LearnerLesson): number {
  return first.order - second.order;
}

/**
 * Required lessons run in sequence: the first one not completed is the
 * frontier, everything after it is locked. An optional lesson "opens together
 * with the nearest available required lesson" (specification 4.2), which means
 * it is available exactly while no locked required lesson stands before it —
 * the frontier itself counts as available, so an optional lesson next to it is
 * open too, and an optional lesson at the very start of a course is open from
 * the first day.
 *
 * A completed lesson stays completed wherever it sits. That is not a corner
 * case invented here: a lesson can be completed and only then published, or
 * unpublished and published back, and both leave a completed lesson standing
 * after the frontier.
 */
export function computeLessonStates(
  lessons: LearnerLesson[],
): LearnerLessonState[] {
  const ordered = [...lessons].sort(byOrder);
  const frontier = ordered.find(
    (lesson) => lesson.isRequired && lesson.progressStatus !== "completed",
  );

  let lockedRequiredSeen = false;

  return ordered.map((lesson) => {
    if (lesson.progressStatus === "completed") {
      return { ...lesson, state: "completed" };
    }

    if (!lesson.isRequired) {
      return { ...lesson, state: lockedRequiredSeen ? "locked" : "available" };
    }

    if (lesson === frontier) {
      return { ...lesson, state: "available" };
    }

    lockedRequiredSeen = true;
    return { ...lesson, state: "locked" };
  });
}

export type RequiredLessonCount = {
  completed: number;
  total: number;
};

/** Optional lessons take part in neither side of the fraction (4.3). */
export function countRequiredLessons(
  lessons: LearnerLesson[],
): RequiredLessonCount {
  const required = lessons.filter((lesson) => lesson.isRequired);

  return {
    completed: required.filter(
      (lesson) => lesson.progressStatus === "completed",
    ).length,
    total: required.length,
  };
}

/**
 * The share of completed required published lessons, rounded to a whole number
 * (specification 4.3); `percentSchema` rejects anything else.
 *
 * A course with no published required lesson reports 0, not 100. Both answers
 * are formally empty, but 100 would mean "finished" and would let an assignment
 * close itself on a course where nothing was ever opened. Specification 4.2
 * makes at least one published required lesson a condition of publication, not
 * an invariant: unpublishing the last one is allowed and a course has no way
 * back to draft.
 */
export function computeProgressPercent(count: RequiredLessonCount): number {
  if (count.total === 0) {
    return 0;
  }

  return Math.round((count.completed / count.total) * 100);
}

/**
 * The first available lesson — specification 7.5 calls it "the first available
 * unfinished lesson", so a completed one is not it. Optional lessons count:
 * they are open and unfinished like any other.
 */
export function findNextLessonId(states: LearnerLessonState[]): string | null {
  return states.find((lesson) => lesson.state === "available")?.id ?? null;
}

export type AdjacentLessons = {
  previousLessonId: string | null;
  nextLessonId: string | null;
};

/**
 * The neighbours shown on the lesson page are the nearest lessons the learner
 * may actually open, not the nearest by number. Specification 7.6 wants the
 * "next lesson" button active only once the current lesson's conditions are
 * met, and the client cannot see a neighbour's state from this response —
 * handing it the identifier of a lesson the server would refuse makes a button
 * that leads to 403.
 */
export function findAdjacentLessons(
  states: LearnerLessonState[],
  lessonId: string,
): AdjacentLessons {
  const index = states.findIndex((lesson) => lesson.id === lessonId);

  if (index === -1) {
    return { previousLessonId: null, nextLessonId: null };
  }

  const isOpen = (lesson: LearnerLessonState): boolean =>
    lesson.state !== "locked";

  return {
    previousLessonId: states.slice(0, index).reverse().find(isOpen)?.id ?? null,
    nextLessonId: states.slice(index + 1).find(isOpen)?.id ?? null,
  };
}

/**
 * Specification 4.3: a course is finished when every required lesson is
 * completed and the final test, if there is one, is passed. A course with no
 * required lessons is not finished, for the reason `computeProgressPercent`
 * gives it a zero.
 */
export function isCourseCompleted(
  count: RequiredLessonCount,
  finalTest: { passed: boolean } | null,
): boolean {
  if (count.total === 0 || count.completed < count.total) {
    return false;
  }

  return finalTest === null || finalTest.passed;
}
