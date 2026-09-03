import type { LearningTestRef } from "@lms/shared";
import { Link } from "react-router-dom";

import styles from "./TestSummaryCard.module.css";

export type TestSummaryCardProps = {
  heading: string;
  test: LearningTestRef;
  canStart: boolean;
};

export function TestSummaryCard({
  heading,
  test,
  canStart,
}: TestSummaryCardProps) {
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
      {canStart && (
        <Link className={styles.start} to={`/learning/tests/${test.id}`}>
          {test.attemptsCount === 0 ? "Пройти тест" : "Пройти тест ещё раз"}
        </Link>
      )}
    </section>
  );
}
