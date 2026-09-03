import type { LearningTestRef } from "@lms/shared";

import styles from "./TestSummaryCard.module.css";

export type TestSummaryCardProps = { heading: string; test: LearningTestRef };

export function TestSummaryCard({ heading, test }: TestSummaryCardProps) {
  return (
    <section className={styles.card}>
      <h2>{heading}</h2>
      <h3>{test.title}</h3>
      <p>Проходной балл {test.passingScore} %</p>
      <p>{test.passed ? "Пройден" : "Не пройден"}</p>
      <p>
        Лучший результат:{" "}
        {test.bestScore === null ? "—" : `${test.bestScore} %`}
      </p>
      <p>Попыток: {test.attemptsCount}</p>
    </section>
  );
}
