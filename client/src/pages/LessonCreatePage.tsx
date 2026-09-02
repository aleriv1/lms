import type { FormError } from "../api/formError";
import { EmptyState, ErrorState, Loader } from "../components/ui";
import { fetchCourse } from "../features/courses/coursesSlice";
import { LessonForm } from "../features/lessons/LessonForm";
import { nextFreeOrder } from "../features/lessons/lessonOrdering";
import { createLesson } from "../features/lessons/lessonsSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { useEffect } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

export function LessonCreatePage() {
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

  const handleSubmit: React.ComponentProps<typeof LessonForm>["onSubmit"] =
    async (body): Promise<FormError | null> => {
      const result = await dispatch(createLesson({ courseId, body }));

      if (createLesson.fulfilled.match(result)) {
        navigate(`/manage/lessons/${result.payload.id}/edit`);
        return null;
      }

      return (
        result.payload ?? {
          code: "internal_error",
          message: "Произошла внутренняя ошибка",
        }
      );
    };

  return (
    <section>
      <Link to={`/manage/courses/${course.id}/edit`}>Назад к курсу</Link>
      <h1>Новый урок курса «{course.title}»</h1>
      <LessonForm
        defaultValues={{ order: nextFreeOrder(course.lessons) }}
        submitLabel="Создать урок"
        onSubmit={handleSubmit}
      />
    </section>
  );
}
