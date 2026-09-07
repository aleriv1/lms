import type { LearningCourseCard } from "@lms/shared";
import { Link } from "react-router-dom";

import { ProgressBar } from "../../components/ui";
import { COURSE_STATUS_LABELS } from "../courses/courseLabels";
import { ASSIGNMENT_STATUS_LABELS, formatDate } from "../users/userFormat";
import styles from "./CourseCard.module.css";

export type CourseCardProps = { card: LearningCourseCard };

/**
 * What the card's one control offers. A finished assignment keeps its access
 * (specification 7.4), so the course stays open for re-reading — but not as
 * "Продолжить", which promises unfinished material. Completion is one way and
 * the learner never resets it: a repeat run comes from a new assignment.
 * A lesson published after the finish lowers the percentage and does leave
 * something to study, and then the invitation is to continue after all.
 */
function controlLabel(card: LearningCourseCard): string {
  if (card.courseStatus === "archived") return "Открыть";
  if (card.assignmentStatus === "completed" && card.progressPercent === 100) {
    return "Просмотреть материалы";
  }
  if (card.lastActivityAt === null) return "Начать";
  return "Продолжить";
}

export function CourseCard({ card }: CourseCardProps) {
  return (
    <article className={styles.card}>
      {card.coverUrl ? (
        <img className={styles.cover} src={card.coverUrl} alt="" />
      ) : (
        <div className={styles.placeholder}>Обложка курса</div>
      )}
      <div className={styles.body}>
        <h3>{card.title}</h3>
        <p>{card.shortDescription}</p>
        <ProgressBar value={card.progressPercent} label="Прогресс курса" />
        <p className={styles.meta}>
          {card.completedLessonsCount} из {card.requiredLessonsCount} уроков
          {card.lastActivityAt !== null &&
            ` · последняя активность ${formatDate(card.lastActivityAt)}`}
        </p>
        {(card.courseStatus === "archived" ||
          card.assignmentStatus !== "active") && (
          <p className={styles.flags}>
            {card.courseStatus === "archived" && (
              <span className={styles.flag}>
                {COURSE_STATUS_LABELS[card.courseStatus]}
              </span>
            )}
            {card.assignmentStatus !== "active" && (
              <span className={styles.flag}>
                {ASSIGNMENT_STATUS_LABELS[card.assignmentStatus]}
              </span>
            )}
          </p>
        )}
        <Link
          className={styles.control}
          to={`/learning/courses/${card.courseId}`}
        >
          {controlLabel(card)}
        </Link>
      </div>
    </article>
  );
}
