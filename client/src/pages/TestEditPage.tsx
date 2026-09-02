import type { CreateTestBody, Test } from "@lms/shared";
import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import type { FormError } from "../api/formError";
import { EmptyState, ErrorState, Loader } from "../components/ui";
import { fetchCourse } from "../features/courses/coursesSlice";
import { TestForm } from "../features/tests/TestForm";
import { fetchTest, updateTest } from "../features/tests/testsSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import styles from "./TestEditPage.module.css";

function toFormValues(test: Test): CreateTestBody {
  return {
    title: test.title,
    lessonId: test.lessonId,
    passingScore: test.passingScore,
    questions: test.questions.map((question) => ({
      text: question.text,
      type: question.type,
      order: question.order,
      options: question.options.map((option) => ({
        text: option.text,
        isCorrect: option.isCorrect,
      })),
    })),
  };
}

const fallbackError: FormError = {
  code: "internal_error",
  message: "Произошла внутренняя ошибка",
};

export function TestEditPage() {
  const { testId } = useParams();
  const dispatch = useAppDispatch();
  const detail = useAppSelector((state) => state.tests.detail);
  const courseDetail = useAppSelector((state) => state.courses.detail);
  const [loadedTestId, setLoadedTestId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadTest = useCallback(() => {
    if (!testId) {
      return;
    }
    return dispatch(fetchTest(testId)).then(async (result) => {
      if (fetchTest.fulfilled.match(result)) {
        await dispatch(fetchCourse(result.payload.courseId));
        setLoadedTestId(testId);
      }
    });
  }, [dispatch, testId]);

  useEffect(() => {
    void loadTest();
  }, [loadTest]);

  if (!testId) {
    return <ErrorState description="Некорректный адрес теста" />;
  }
  if (detail.status === "idle" || detail.status === "loading") {
    return <Loader label="Загрузка теста" />;
  }
  if (detail.status === "error") {
    if (detail.error?.code === "forbidden") {
      return <Navigate to="/forbidden" replace />;
    }
    if (detail.error?.code === "not_found") {
      return (
        <EmptyState
          title="Тест не найден"
          description="Возможно, он был удален."
          action={<Link to="/manage/courses">Вернуться в каталог</Link>}
        />
      );
    }
    return (
      <ErrorState
        description={detail.error?.message}
        onRetry={() => void loadTest()}
      />
    );
  }

  const test = detail.test;
  if (
    !test ||
    test.id !== testId ||
    loadedTestId !== testId ||
    courseDetail.status === "idle" ||
    courseDetail.status === "loading"
  ) {
    return <Loader label="Загрузка курса" />;
  }
  if (courseDetail.status === "error") {
    if (courseDetail.error?.code === "forbidden") {
      return <Navigate to="/forbidden" replace />;
    }
    if (courseDetail.error?.code === "not_found") {
      return (
        <EmptyState
          title="Курс не найден"
          description="Возможно, он был удален."
          action={<Link to="/manage/courses">Вернуться в каталог</Link>}
        />
      );
    }
    return (
      <ErrorState
        description={courseDetail.error?.message}
        onRetry={() => void dispatch(fetchCourse(test.courseId))}
      />
    );
  }

  const course = courseDetail.course;
  if (!course || course.id !== test.courseId) {
    return <ErrorState onRetry={() => void loadTest()} />;
  }

  const handleSave = async (
    body: CreateTestBody,
  ): Promise<FormError | null> => {
    setSuccessMessage(null);
    const result = await dispatch(
      updateTest({ courseId: test.courseId, testId, body }),
    );
    if (updateTest.fulfilled.match(result)) {
      setSuccessMessage("Изменения сохранены");
      return null;
    }
    return result.payload ?? fallbackError;
  };

  return (
    <section>
      <Link
        className={styles.backLink}
        to={`/manage/courses/${course.id}/edit`}
      >
        Назад к курсу
      </Link>
      <h1>Редактирование теста</h1>
      <p>Курс: {course.title}</p>
      {successMessage && (
        <p className={styles.success} role="status">
          {successMessage}
        </p>
      )}
      <TestForm
        key={test.id}
        defaultValues={toFormValues(test)}
        lessons={course.lessons}
        isFinalTestTaken={course.tests.some(
          (item) => item.lessonId === null && item.id !== test.id,
        )}
        submitLabel="Сохранить изменения"
        onSubmit={handleSave}
      />
    </section>
  );
}
