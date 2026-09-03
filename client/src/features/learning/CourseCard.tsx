import type { LearningCourseCard } from "@lms/shared";
import { Link } from "react-router-dom";

import { ProgressBar } from "../../components/ui";
import { COURSE_STATUS_LABELS } from "../courses/courseLabels";
import { ASSIGNMENT_STATUS_LABELS, formatDateTime } from "../users/userFormat";
import styles from "./CourseCard.module.css";

export type CourseCardProps = { card: LearningCourseCard };

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
        <p>
          {card.completedLessonsCount} из {card.requiredLessonsCount} уроков
        </p>
        <p>Курс: {COURSE_STATUS_LABELS[card.courseStatus]}</p>
        <p>Назначение: {ASSIGNMENT_STATUS_LABELS[card.assignmentStatus]}</p>
        <p>
          Последняя активность:{" "}
          {card.lastActivityAt === null
            ? "—"
            : formatDateTime(card.lastActivityAt)}
        </p>
        <Link
          className={styles.control}
          to={`/learning/courses/${card.courseId}`}
        >
          {card.courseStatus === "archived"
            ? "Открыть"
            : card.lastActivityAt === null
              ? "Начать"
              : "Продолжить"}
        </Link>
      </div>
    </article>
  );
}
