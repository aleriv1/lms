import { useEffect } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import type { FormError } from "../api/formError";
import { EmptyState, ErrorState, Loader } from "../components/ui";
import { fetchCourse } from "../features/courses/coursesSlice";
import { TestForm } from "../features/tests/TestForm";
import { createTest } from "../features/tests/testsSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";

export function TestCreatePage() {
  const { courseId } = useParams();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const detail = useAppSelector((state) => state.courses.detail);

  useEffect(() => {
    if (courseId) {
      void dispatch(fetchCourse(courseId));
    }
  }, [courseId, dispatch]);

  if (!courseId) {
    return <ErrorState description="Некорректный адрес курса" />;
  }

  if (detail.status === "idle" || detail.status === "loading") {
    return <Loader label="Загрузка курса" />;
  }

  if (detail.status === "error") {
    if (detail.error?.code === "forbidden") {
      return <Navigate to="/forbidden" replace />;
    }
    if (detail.error?.code === "not_found") {
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
        description={detail.error?.message}
        onRetry={() => void dispatch(fetchCourse(courseId))}
      />
    );
  }

  const course = detail.course;
  if (!course || course.id !== courseId) {
    return <ErrorState />;
  }

  const handleSubmit: React.ComponentProps<
    typeof TestForm
  >["onSubmit"] = async (body): Promise<FormError | null> => {
    const result = await dispatch(createTest({ courseId, body }));

    if (createTest.fulfilled.match(result)) {
      navigate(`/manage/tests/${result.payload.id}/edit`);
      return null;
    }

    return (
      result.payload ?? {
        code: "internal_error",
        message: "Произошла внутренняя ошибка",
      }
    );
  };

  const isFinalTestTaken = course.tests.some((test) => test.lessonId === null);

  return (
    <section>
      <Link to={`/manage/courses/${course.id}/edit`}>Назад к курсу</Link>
      <h1>Новый тест курса «{course.title}»</h1>
      <TestForm
        key={course.id}
        defaultValues={{
          lessonId: isFinalTestTaken
            ? (course.lessons.find((lesson) => !lesson.testId)?.id ?? null)
            : null,
        }}
        lessons={course.lessons}
        isFinalTestTaken={isFinalTestTaken}
        submitLabel="Создать тест"
        onSubmit={handleSubmit}
      />
    </section>
  );
}
