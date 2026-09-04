import type { AttemptReviewQuestion } from "@lms/shared";
import type { ReactNode } from "react";

import styles from "./AttemptReview.module.css";

export type AttemptReviewProps = { review: AttemptReviewQuestion[] };

export function AttemptReview({ review }: AttemptReviewProps): ReactNode {
  if (review.length === 0) return null;

  return (
    <div className={styles.review}>
      <h3>Разбор ответов</h3>
      <ol className={styles.questions}>
        {review.map((question) => (
          <li key={question.questionId} value={question.order}>
            <p className={styles.question}>{question.text}</p>
            <p>{question.isCorrect ? "Верно" : "Неверно"}</p>
            {!question.options.some((option) => option.isSelected) && (
              <p>Вы не ответили</p>
            )}
            <ul className={styles.options}>
              {question.options.map((option) => (
                <li className={styles.option} key={option.id}>
                  <span>{option.text}</span>
                  {option.isCorrect && <strong>правильный ответ</strong>}
                  {option.isSelected && <span>ваш выбор</span>}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
