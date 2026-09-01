import { Link, useNavigate } from "react-router-dom";

import type { FormError } from "../api/formError";
import { CourseForm } from "../features/courses/CourseForm";
import { createCourse } from "../features/courses/coursesSlice";
import { useAppDispatch } from "../store/hooks";

export function CourseCreatePage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const handleSubmit: React.ComponentProps<typeof CourseForm>["onSubmit"] =
    async (body): Promise<FormError | null> => {
      const result = await dispatch(createCourse(body));

      if (createCourse.fulfilled.match(result)) {
        navigate(`/manage/courses/${result.payload.id}/edit`);
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
      <Link to="/manage/courses">Назад в каталог</Link>
      <h1>Создание курса</h1>
      <CourseForm submitLabel="Создать курс" onSubmit={handleSubmit} />
    </section>
  );
}
