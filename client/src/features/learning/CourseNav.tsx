import type { LearningLessonItem } from "@lms/shared";
import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

import { Loader, ProgressBar } from "../../components/ui";
import { useAppSelector } from "../../store/hooks";
import { formatMinutes, LESSON_ACCESS_STATE_LABELS } from "./learningFormat";
import styles from "./CourseNav.module.css";

export type CourseNavProps = {
  navId: string;
  courseId: string;
  currentLessonId: string;
  onNavigate: () => void;
};

function LessonItem({
  courseId,
  lesson,
  isCurrent,
  onNavigate,
}: {
  courseId: string;
  lesson: LearningLessonItem;
  isCurrent: boolean;
  onNavigate: () => void;
}) {
  const body = (
    <>
      <span className={styles.order}>{lesson.order}</span>
      <span>{lesson.title}</span>
      <span className={styles.duration}>
        {formatMinutes(lesson.durationMinutes)}
      </span>
      {/* Colour alone carries the state for sighted users; keep the word. */}
      <span className={styles.state}>
        {LESSON_ACCESS_STATE_LABELS[lesson.state]}
      </span>
    </>
  );

  if (isCurrent) {
    return (
      <span className={`${styles.item} ${styles.current}`} aria-current="step">
        {body}
      </span>
    );
  }

  if (lesson.state === "locked") {
    return <span className={`${styles.item} ${styles.locked}`}>{body}</span>;
  }

  return (
    <Link
      className={`${styles.item} ${
        lesson.state === "completed" ? styles.completed : ""
      }`}
      to={`/learning/courses/${courseId}/lessons/${lesson.id}`}
      onClick={onNavigate}
    >
      {body}
    </Link>
  );
}

/**
 * The course rail that replaces the global menu while a lesson is open. The
 * lesson page owns the request for the course, so this only reads what the page
 * left in the store — two fetchers would double every request and race the
 * page's own abort handling.
 */
export function CourseNav({
  navId,
  courseId,
  currentLessonId,
  onNavigate,
}: CourseNavProps) {
  const { status, data } = useAppSelector((state) => state.learning.course);
  // A course left over from the previous route must never paint here.
  const course =
    status === "ready" && data?.id.toLowerCase() === courseId.toLowerCase()
      ? data
      : null;
  const currentItem = useRef<HTMLLIElement>(null);

  // On a long course the list scrolls, and lesson forty must not open with the
  // rail sitting on lesson one.
  useEffect(() => {
    currentItem.current?.scrollIntoView({ block: "nearest" });
  }, [course?.id, currentLessonId]);

  return (
    <div className={styles.rail}>
      <Link
        className={styles.exit}
        to={`/learning/courses/${courseId}`}
        onClick={onNavigate}
      >
        ← К курсу
      </Link>
      {course && (
        <>
          <p className={styles.courseTitle}>{course.title}</p>
          <ProgressBar value={course.progressPercent} label="Прогресс курса" />
        </>
      )}
      <nav
        className={styles.navigation}
        id={navId}
        aria-label="Навигация по курсу"
      >
        {course ? (
          <ol className={styles.list}>
            {course.lessons.map((lesson) => {
              const isCurrent =
                lesson.id.toLowerCase() === currentLessonId.toLowerCase();

              return (
                <li key={lesson.id} ref={isCurrent ? currentItem : null}>
                  <LessonItem
                    courseId={courseId}
                    lesson={lesson}
                    isCurrent={isCurrent}
                    onNavigate={onNavigate}
                  />
                </li>
              );
            })}
          </ol>
        ) : (
          // The page renders the failure itself; the rail must not repeat it.
          status !== "error" && <Loader label="Загрузка курса" />
        )}
      </nav>
    </div>
  );
}
