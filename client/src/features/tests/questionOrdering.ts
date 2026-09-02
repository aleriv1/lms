export function renumberQuestions<T extends { order: number }>(
  questions: T[],
): T[] {
  return questions.map((question, index) => ({
    ...question,
    order: index + 1,
  }));
}

export function canMoveQuestion(
  index: number,
  count: number,
  direction: "up" | "down",
): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    return false;
  }

  return direction === "up" ? index > 0 : index < count - 1;
}
