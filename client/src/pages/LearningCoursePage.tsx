import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";

import { EmptyState, ErrorState, Loader, ProgressBar } from "../components/ui";
import {
  COURSE_AUDIENCE_LABELS,
  COURSE_STATUS_LABELS,
} from "../features/courses/courseLabels";
import { LessonToc } from "../features/learning/LessonToc";
import { TestSummaryCard } from "../features/learning/TestSummaryCard";
import { fetchLearningCourse } from "../features/learning/learningSlice";
import { ASSIGNMENT_STATUS_LABELS } from "../features/users/userFormat";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import styles from "./LearningCoursePage.module.css";

export function LearningCoursePage() {
  const { courseId } = useParams();
  const dispatch = useAppDispatch();
  const detail = useAppSelector((state) => state.learning.course);

  useEffect(() => {
    if (!courseId) return;
    const request = dispatch(fetchLearningCourse(courseId));
    return () => request.abort();
  }, [dispatch, courseId]);

  const backLink = <Link to="/learning">Вернуться к обучению</Link>;
  if (!courseId) {
    return <EmptyState title="404 — Курс не найден" action={backLink} />;
  }
  if (detail.data && detail.data.id.toLowerCase() !== courseId.toLowerCase()) {
    return <Loader label="Загрузка курса" />;
  }
  if (detail.status === "error") {
    if (detail.error?.code === "course_not_assigned") {
      return (
        <EmptyState
          title="Курс вам не назначен"
          description={detail.error.message}
          action={backLink}
        />
      );
    }
    if (detail.error?.code === "not_found") {
      return (
        <EmptyState
          title="404 — Курс не найден"
          description={detail.error.message}
          action={backLink}
        />
      );
    }
    return (
      <section className={styles.page}>
        {backLink}
        <ErrorState
          description={detail.error?.message}
          onRetry={() => void dispatch(fetchLearningCourse(courseId))}
        />
      </section>
    );
  }
  if (!detail.data) return <Loader label="Загрузка курса" />;

  const course = detail.data;
  return (
    <section className={styles.page}>
      {backLink}
      <header className={styles.header}>
        {course.coverUrl ? (
          <img className={styles.cover} src={course.coverUrl} alt="" />
        ) : (
          <div className={styles.placeholder}>Обложка курса</div>
        )}
        <div className={styles.summary}>
          <h1>{course.title}</h1>
          <p>{course.shortDescription}</p>
          <p>Категория: {course.category}</p>
          <p>Аудитория: {COURSE_AUDIENCE_LABELS[course.audience]}</p>
          <p>Автор: {course.author.name}</p>
          <p>Курс: {COURSE_STATUS_LABELS[course.courseStatus]}</p>
          <p>Назначение: {ASSIGNMENT_STATUS_LABELS[course.assignmentStatus]}</p>
        </div>
      </header>
      <p className={styles.description}>{course.description}</p>
      <ProgressBar value={course.progressPercent} label="Прогресс курса" />
      {course.courseStatus === "archived" ? (
        <p className={styles.notice}>
          Курс в архиве: доступен только для просмотра
        </p>
      ) : (
        course.nextLessonId !== null && (
          <Link
            className={styles.control}
            to={`/learning/courses/${course.id}/lessons/${course.nextLessonId}`}
          >
            Продолжить обучение
          </Link>
        )
      )}
      <LessonToc courseId={course.id} lessons={course.lessons} />
      {course.finalTest && (
        <TestSummaryCard
          heading="Итоговый тест"
          test={course.finalTest}
          canStart={course.courseStatus !== "archived"}
        />
      )}
    </section>
  );
}
