import type { SubmitAttemptBody } from "@lms/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { toFormError, type FormError } from "../api/formError";
import { Button, EmptyState, ErrorState, Loader } from "../components/ui";
import { TestAttemptForm } from "../features/learning/TestAttemptForm";
import { AttemptReview } from "../features/learning/AttemptReview";
import {
  clearAttemptResult,
  fetchLearnerTest,
  fetchLearningCourse,
  fetchLearningLesson,
  submitAttempt,
} from "../features/learning/learningSlice";
import { formatDateTime } from "../features/users/userFormat";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import styles from "./LearningTestPage.module.css";

function LearningTestScreen({ testId }: { testId: string }) {
  const dispatch = useAppDispatch();
  const testState = useAppSelector((state) => state.learning.test);
  const courseState = useAppSelector((state) => state.learning.course);
  const attempt = useAppSelector((state) => state.learning.attempt.data);
  const [courseCompleted, setCourseCompleted] = useState(false);
  const active = useRef(false);
  const pendingRequests = useRef<{ abort(): void }[]>([]);
  const courseRead = useRef<{ abort(): void } | null>(null);
  const test =
    testState.data?.id.toLowerCase() === testId.toLowerCase()
      ? testState.data
      : null;
  const courseId = testState.status === "ready" ? test?.courseId : undefined;
  const course =
    courseState.status === "ready" &&
      courseState.data?.id.toLowerCase() === courseId?.toLowerCase()
      ? courseState.data
      : null;

  const reloadTest = useCallback(() => {
    const request = dispatch(fetchLearnerTest(testId));
    pendingRequests.current.push(request);
    return request;
  }, [dispatch, testId]);

  useEffect(() => {
    active.current = true;
    void reloadTest();
    return () => {
      active.current = false;
      for (const request of pendingRequests.current) request.abort();
      pendingRequests.current = [];
    };
  }, [reloadTest]);

  useEffect(() => {
    if (!courseId) return;
    const request = dispatch(fetchLearningCourse(courseId));
    courseRead.current = request;
    pendingRequests.current.push(request);
    return () => request.abort();
  }, [dispatch, courseId]);

  const learningLink = <Link to="/learning">Вернуться к обучению</Link>;

  if (testState.status === "error") {
    const error = testState.error;
    if (
      error?.code === "course_not_assigned" ||
      error?.code === "lesson_locked" ||
      error?.code === "not_found"
    ) {
      return (
        <EmptyState
          title={
            error.code === "course_not_assigned"
              ? "Курс вам не назначен"
              : error.code === "lesson_locked"
                ? "Тест пока закрыт"
                : "404 — Тест не найден"
          }
          description={error.message}
          action={learningLink}
        />
      );
    }
    return (
      <section className={styles.page}>
        {learningLink}
        <ErrorState
          description={error?.message}
          onRetry={() => void reloadTest()}
        />
      </section>
    );
  }
  if (testState.status !== "ready" || !test)
    return <Loader label="Загрузка теста" />;

  const lesson = course?.lessons.find(
    (item) => item.id.toLowerCase() === test.lessonId?.toLowerCase(),
  );
  const courseLink = (
    <Link to={`/learning/courses/${test.courseId}`}>Вернуться к курсу</Link>
  );
  const backLinks = (
    <nav className={styles.links} aria-label="Навигация по обучению">
      {test.lessonId !== null && (
        <Link
          to={`/learning/courses/${test.courseId}/lessons/${test.lessonId}`}
        >
          Вернуться к уроку
        </Link>
      )}
      {courseLink}
      {learningLink}
    </nav>
  );

  const handleSubmit = async (
    body: SubmitAttemptBody,
  ): Promise<FormError | null> => {
    setCourseCompleted(false);
    const request = dispatch(submitAttempt({ testId: test.id, body }));
    pendingRequests.current.push(request);
    const result = await request;
    if (!active.current) return null;
    if (submitAttempt.rejected.match(result)) {
      return result.payload ?? toFormError(result.error);
    }
    if (result.payload.passed) {
      // A slower initial course read must not overwrite the post-pass refresh.
      courseRead.current?.abort();
      const refresh = dispatch(fetchLearningCourse(test.courseId));
      courseRead.current = refresh;
      pendingRequests.current.push(refresh);
      if (test.lessonId !== null) {
        const lessonRefresh = dispatch(
          fetchLearningLesson({
            courseId: test.courseId,
            lessonId: test.lessonId,
          }),
        );
        pendingRequests.current.push(lessonRefresh);
      }
      const refreshed = await refresh;
      if (active.current && fetchLearningCourse.fulfilled.match(refreshed)) {
        setCourseCompleted(refreshed.payload.assignmentStatus === "completed");
      }
    }
    return null;
  };

  return (
    <section className={styles.page}>
      <header className={styles.heading}>
        <h1>{test.title}</h1>
        {course && (
          <Link className={styles["heading-links"]} to={`/learning/courses/${course.id}`}>{course.title}</Link>
        )}
        {lesson && (
          <Link className={styles["heading-links"]} to={`/learning/courses/${test.courseId}/lessons/${lesson.id}`}>
            {lesson.title}
          </Link>
        )}
        <p>Проходной балл {test.passingScore} %</p>
      </header>
      {course?.courseStatus === "archived" ? (
        <EmptyState
          title="Курс в архиве: новые попытки недоступны"
          action={
            <div className={styles.links}>
              {courseLink}
              {learningLink}
            </div>
          }
        />
      ) : attempt?.testId.toLowerCase() === test.id.toLowerCase() ? (
        <section className={styles.result} aria-label="Результат попытки">
          <h2>{attempt.passed ? "Тест пройден" : "Тест не пройден"}</h2>
          <p className={styles.score}>{attempt.score} %</p>
          <p>Проходной балл {attempt.passingScore} %</p>
          <p>
            Правильных ответов: {attempt.correctCount} из {attempt.totalCount}
          </p>
          <p>Попытка №{attempt.attemptNumber}</p>
          <p>{formatDateTime(attempt.submittedAt)}</p>
          <AttemptReview review={attempt.review} />
          {attempt.passed && courseCompleted && (
            <p className={styles.success} role="status">
              Курс пройден
            </p>
          )}
          <div>
            <Button
              onClick={() => {
                setCourseCompleted(false);
                dispatch(clearAttemptResult());
              }}
            >
              Пройти ещё раз
            </Button>
          </div>
        </section>
      ) : (
        <TestAttemptForm test={test} onSubmit={handleSubmit} />
      )}
      {backLinks}
    </section>
  );
}

export function LearningTestPage() {
  const { testId } = useParams();
  if (!testId) {
    return (
      <EmptyState
        title="404 — Тест не найден"
        action={<Link to="/learning">Вернуться к обучению</Link>}
      />
    );
  }
  return <LearningTestScreen key={testId.toLowerCase()} testId={testId} />;
}
