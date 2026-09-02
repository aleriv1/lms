import {
  LESSON_ORDER_MAX,
  LESSON_ORDER_MIN,
  type LessonSummary,
  type ReorderLessonsBody,
} from "@lms/shared";

/** Ascending by `order`; the server sends them sorted, this keeps them so after a local edit. */
export function sortLessons(lessons: LessonSummary[]): LessonSummary[] {
  return [...lessons].sort((first, second) => first.order - second.order);
}

/** Smallest number in [LESSON_ORDER_MIN, LESSON_ORDER_MAX] no lesson holds; LESSON_ORDER_MAX when all are taken. */
export function nextFreeOrder(lessons: LessonSummary[]): number {
  const occupiedOrders = new Set(lessons.map((lesson) => lesson.order));

  for (let order = LESSON_ORDER_MIN; order <= LESSON_ORDER_MAX; order += 1) {
    if (!occupiedOrders.has(order)) {
      return order;
    }
  }

  return LESSON_ORDER_MAX;
}

/** The whole list renumbered 1..N with one lesson moved; null when the move is impossible. */
export function moveLesson(
  lessons: LessonSummary[],
  lessonId: string,
  direction: "up" | "down",
): ReorderLessonsBody | null {
  const orderedLessons = sortLessons(lessons);
  const currentIndex = orderedLessons.findIndex(
    (lesson) => lesson.id === lessonId,
  );
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (
    currentIndex < 0 ||
    targetIndex < 0 ||
    targetIndex >= orderedLessons.length
  ) {
    return null;
  }

  const currentLesson = orderedLessons[currentIndex];
  const targetLesson = orderedLessons[targetIndex];
  if (!currentLesson || !targetLesson) {
    return null;
  }

  const movedLessons = [...orderedLessons];
  [movedLessons[currentIndex], movedLessons[targetIndex]] = [
    targetLesson,
    currentLesson,
  ];

  return {
    lessons: movedLessons.map((lesson, index) => ({
      lessonId: lesson.id,
      order: index + LESSON_ORDER_MIN,
    })),
  };
}
