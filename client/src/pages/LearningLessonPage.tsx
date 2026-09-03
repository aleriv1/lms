import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Link, useParams } from "react-router-dom";

import { toFormError, type FormError } from "../api/formError";
import {
  Button,
  EmptyState,
  ErrorState,
  Loader,
  ProgressBar,
} from "../components/ui";
import { LessonToc } from "../features/learning/LessonToc";
import { TestSummaryCard } from "../features/learning/TestSummaryCard";
import {
  formatMinutes,
  LESSON_PROGRESS_STATUS_LABELS,
} from "../features/learning/learningFormat";
import {
  completeLesson,
  fetchLearningCourse,
  fetchLearningLesson,
  startLesson,
} from "../features/learning/learningSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import styles from "./LearningLessonPage.module.css";

function ActionError({
  error,
  courseId,
}: {
  error: FormError;
  courseId: string;
}) {
  return (
    <div className={styles.error} role="alert">
      <p>{error.message}</p>
      {error.fields && (
        <ul>
          {error.fields.map((fieldError) => (
            <li key={`${fieldError.field}-${fieldError.message}`}>
              {fieldError.message}
            </li>
          ))}
        </ul>
      )}
      {error.code === "course_not_assigned" && (
        <Link to="/learning">Вернуться к обучению</Link>
      )}
      {(error.code === "lesson_locked" ||
        error.code === "not_found" ||
        error.code === "forbidden") && (
        <Link to={`/learning/courses/${courseId}`}>Вернуться к курсу</Link>
      )}
    </div>
  );
}

function LearningLessonScreen({
  courseId,
  lessonId,
  startedLessons,
}: {
  courseId: string;
  lessonId: string;
  startedLessons: RefObject<Set<string>>;
}) {
  const dispatch = useAppDispatch();
  const courseState = useAppSelector((state) => state.learning.course);
  const lessonState = useAppSelector((state) => state.learning.lesson);
  const [actionError, setActionError] = useState<FormError | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [courseCompleted, setCourseCompleted] = useState(false);
  const active = useRef(false);
  const pendingReads = useRef<{ abort(): void }[]>([]);
  const startRequest = useRef<Promise<void> | null>(null);
  const course = courseState.data;
  const lesson = lessonState.data;

  const reloadCourse = useCallback(() => {
    const request = dispatch(fetchLearningCourse(courseId));
    pendingReads.current.push(request);
    return request;
  }, [dispatch, courseId]);

  const reloadLesson = useCallback(() => {
    const request = dispatch(fetchLearningLesson({ courseId, lessonId }));
    pendingReads.current.push(request);
    return request;
  }, [dispatch, courseId, lessonId]);

  useEffect(() => {
    active.current = true;
    void reloadLesson();
    void reloadCourse();
    return () => {
      active.current = false;
      // Ignore late reads of the previous URL, including action refreshes.
      for (const request of pendingReads.current) request.abort();
      pendingReads.current = [];
    };
  }, [reloadCourse, reloadLesson]);

  useEffect(() => {
    if (
      lessonState.status !== "ready" ||
      courseState.status !== "ready" ||
      lesson?.id.toLowerCase() !== lessonId.toLowerCase() ||
      lesson.courseId.toLowerCase() !== courseId.toLowerCase() ||
      course?.id.toLowerCase() !== courseId.toLowerCase() ||
      lesson.progressStatus !== "not_started" ||
      course.courseStatus !== "published" ||
      startedLessons.current.has(lessonId.toLowerCase())
    )
      return;

    startedLessons.current.add(lessonId.toLowerCase());
    startRequest.current = dispatch(startLesson(lessonId)).then(
      async (result) => {
        if (!active.current || !startLesson.fulfilled.match(result)) return;
        // `courseCompleted` is ignored here on purpose: `start` fires by itself
        // when the page opens, and an already finished course answers `true`.
        // The notice confirms an action the learner took, so only `complete`
        // may raise it.
        await Promise.all([reloadLesson(), reloadCourse()]);
      },
    );
  }, [
    dispatch,
    course,
    lesson,
    courseState.status,
    lessonState.status,
    courseId,
    lessonId,
    startedLessons,
    reloadCourse,
    reloadLesson,
  ]);

  const courseLink = (
    <Link to={`/learning/courses/${courseId}`}>Вернуться к курсу</Link>
  );
  const learningLink = <Link to="/learning">Вернуться к обучению</Link>;

  if (
    (course && course.id.toLowerCase() !== courseId.toLowerCase()) ||
    (lesson &&
      (lesson.id.toLowerCase() !== lessonId.toLowerCase() ||
        lesson.courseId.toLowerCase() !== courseId.toLowerCase()))
  )
    return <Loader label="Загрузка урока" />;

  if (lessonState.status === "error" || courseState.status === "error") {
    const isLessonError = lessonState.status === "error";
    const error = isLessonError ? lessonState.error : courseState.error;
    if (error?.code === "course_not_assigned") {
      return (
        <EmptyState
          title="Курс вам не назначен"
          description={error.message}
          action={learningLink}
        />
      );
    }
    if (error?.code === "lesson_locked") {
      return (
        <EmptyState
          title="Урок пока закрыт"
          description={error.message}
          action={courseLink}
        />
      );
    }
    if (error?.code === "not_found") {
      return (
        <EmptyState
          title={
            isLessonError ? "404 — Урок не найден" : "404 — Курс не найден"
          }
          description={error.message}
          action={isLessonError ? courseLink : learningLink}
        />
      );
    }
    return (
      <section className={styles.page}>
        {courseLink}
        <ErrorState
          description={error?.message}
          onRetry={() => {
            void (isLessonError ? reloadLesson() : reloadCourse());
          }}
        />
      </section>
    );
  }
  if (!course || !lesson) return <Loader label="Загрузка урока" />;

  const handleComplete = async () => {
    if (isActionLoading) return;
    setActionError(null);
    setIsActionLoading(true);
    // A late start or its refresh must not overwrite a successful completion.
    await startRequest.current;
    if (!active.current) return;
    const result = await dispatch(completeLesson(lessonId));
    if (!active.current) return;
    if (completeLesson.rejected.match(result)) {
      setActionError(result.payload ?? toFormError(result.error));
    } else {
      setCourseCompleted(result.payload.courseCompleted);
      await Promise.all([reloadLesson(), reloadCourse()]);
    }
    if (active.current) setIsActionLoading(false);
  };

  return (
    <section className={styles.page}>
      {courseLink}
      <header className={styles.heading}>
        <p>{course.title}</p>
        <h1>{lesson.title}</h1>
        <p>
          Урок {lesson.order} · {formatMinutes(lesson.durationMinutes)} ·{" "}
          {lesson.isRequired ? "Обязательный" : "Необязательный"}
        </p>
        <p role="status">
          Состояние: {LESSON_PROGRESS_STATUS_LABELS[lesson.progressStatus]}
        </p>
      </header>
      <ProgressBar
        value={lesson.courseProgressPercent}
        label="Прогресс курса"
      />
      {course.courseStatus === "archived" && (
        <p className={styles.notice}>
          Курс в архиве: доступен только для просмотра
        </p>
      )}
      <section className={styles.material}>
        <h2>Материал урока</h2>
        {/* HTML sanitised on write in server/src/lessons/sanitizeContent.ts. */}
        <div
          className={styles.content}
          dangerouslySetInnerHTML={{ __html: lesson.content }}
        />
      </section>
      {lesson.videoUrl && (
        <section>
          <h2>Видео</h2>
          <a href={lesson.videoUrl} target="_blank" rel="noopener noreferrer">
            Открыть видео
          </a>
        </section>
      )}
      {lesson.resourceLinks.length > 0 && (
        <section>
          <h2>Дополнительные материалы</h2>
          <ul className={styles.resources}>
            {lesson.resourceLinks.map((link, index) => (
              <li key={`${index}-${link.url}`}>
                <a href={link.url} target="_blank" rel="noopener noreferrer">
                  {link.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      {lesson.requiredTest && (
        <section className={styles.test}>
          <TestSummaryCard heading="Тест урока" test={lesson.requiredTest} />
          <p>Урок завершается прохождением теста</p>
        </section>
      )}
      {actionError && <ActionError error={actionError} courseId={course.id} />}
      {!lesson.requiredTest && course.courseStatus !== "archived" && (
        <div>
          <Button
            isLoading={isActionLoading}
            onClick={() => void handleComplete()}
          >
            Завершить урок
          </Button>
        </div>
      )}
      {courseCompleted && (
        <div className={styles.success} role="status">
          <p>Курс пройден</p>
          {courseLink}
        </div>
      )}
      <nav className={styles.neighbours} aria-label="Навигация по урокам">
        {lesson.previousLessonId !== null && (
          <Link
            to={`/learning/courses/${course.id}/lessons/${lesson.previousLessonId}`}
          >
            Предыдущий урок
          </Link>
        )}
        {lesson.nextLessonId !== null && (
          <Link
            to={`/learning/courses/${course.id}/lessons/${lesson.nextLessonId}`}
          >
            Следующий урок
          </Link>
        )}
      </nav>
      <LessonToc
        courseId={course.id}
        lessons={course.lessons}
        currentLessonId={lesson.id}
      />
    </section>
  );
}

export function LearningLessonPage() {
  const { courseId, lessonId } = useParams();
  const startedLessons = useRef(new Set<string>());
  if (!courseId || !lessonId) {
    return (
      <EmptyState
        title="404 — Урок не найден"
        action={<Link to="/learning">Вернуться к обучению</Link>}
      />
    );
  }
  return (
    <LearningLessonScreen
      key={`${courseId.toLowerCase()}/${lessonId.toLowerCase()}`}
      courseId={courseId}
      lessonId={lessonId}
      startedLessons={startedLessons}
    />
  );
}
