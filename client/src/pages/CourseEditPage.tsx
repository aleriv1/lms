import type { CourseDetail, CreateCourseBody } from "@lms/shared";
import { useEffect, useState } from "react";
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
} from "react-router-dom";

import type { FormError } from "../api/formError";
import { Button, EmptyState, ErrorState, Loader, Modal } from "../components/ui";
import { COURSE_STATUS_LABELS } from "../features/courses/courseLabels";
import { CourseForm } from "../features/courses/CourseForm";
import {
  archiveCourse,
  deleteCourse,
  fetchCourse,
  publishCourse,
  updateCourse,
} from "../features/courses/coursesSlice";
import { LessonList } from "../features/lessons/LessonList";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import styles from "./CourseEditPage.module.css";

type ConfirmationAction = "archive" | "delete";

function ActionError({ error }: { error: FormError }) {
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
    </div>
  );
}

function toFormValues(course: CourseDetail): CreateCourseBody {
  return {
    title: course.title,
    category: course.category,
    audience: course.audience,
    shortDescription: course.shortDescription,
    description: course.description,
    coverUrl: course.coverUrl,
  };
}

export function CourseEditPage() {
  const { courseId } = useParams();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const detail = useAppSelector((state) => state.courses.detail);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<FormError | null>(null);
  const [confirmation, setConfirmation] =
    useState<ConfirmationAction | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

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
  if (!course) {
    return <ErrorState />;
  }

  const handleSave = async (body: CreateCourseBody): Promise<FormError | null> => {
    setSuccessMessage(null);
    setActionError(null);
    const result = await dispatch(updateCourse({ courseId, body }));

    if (updateCourse.fulfilled.match(result)) {
      setSuccessMessage("Изменения сохранены");
      return null;
    }

    return (
      result.payload ?? {
        code: "internal_error",
        message: "Произошла внутренняя ошибка",
      }
    );
  };

  const handlePublish = async () => {
    setSuccessMessage(null);
    setActionError(null);
    setIsActionLoading(true);
    const result = await dispatch(publishCourse(courseId));
    setIsActionLoading(false);

    if (publishCourse.fulfilled.match(result)) {
      setSuccessMessage("Курс опубликован");
      return;
    }

    setActionError(
      result.payload ?? {
        code: "internal_error",
        message: "Произошла внутренняя ошибка",
      },
    );
  };

  const confirmAction = async () => {
    if (!confirmation) {
      return;
    }

    setSuccessMessage(null);
    setActionError(null);
    setIsActionLoading(true);
    const result =
      confirmation === "delete"
        ? await dispatch(deleteCourse(courseId))
        : await dispatch(archiveCourse(courseId));
    setIsActionLoading(false);

    if (
      deleteCourse.rejected.match(result) ||
      archiveCourse.rejected.match(result)
    ) {
      setActionError(
        result.payload ?? {
          code: "internal_error",
          message: "Произошла внутренняя ошибка",
        },
      );
      return;
    }

    setConfirmation(null);
    if (confirmation === "delete") {
      navigate("/manage/courses");
    } else {
      setSuccessMessage("Курс архивирован");
    }
  };

  return (
    <section>
      <Link className={styles.backLink} to="/manage/courses">
        Назад в каталог
      </Link>
      <div className={styles.heading}>
        <div>
          <h1>Редактирование курса</h1>
          <p>Статус: {COURSE_STATUS_LABELS[course.status]}</p>
        </div>
        <div className={styles.actions}>
          {course.status !== "published" && (
            <Button
              disabled={isActionLoading}
              onClick={() => void handlePublish()}
            >
              Опубликовать
            </Button>
          )}
          {course.status !== "archived" && (
            <Button
              variant="secondary"
              disabled={isActionLoading}
              onClick={() => {
                setActionError(null);
                setConfirmation("archive");
              }}
            >
              Архивировать
            </Button>
          )}
          {course.status === "draft" && (
            <Button
              variant="danger"
              disabled={isActionLoading}
              onClick={() => {
                setActionError(null);
                setConfirmation("delete");
              }}
            >
              Удалить
            </Button>
          )}
        </div>
      </div>

      {successMessage && (
        <p className={styles.success} role="status">
          {successMessage}
        </p>
      )}
      {actionError && !confirmation && <ActionError error={actionError} />}

      <CourseForm
        key={course.id}
        defaultValues={toFormValues(course)}
        submitLabel="Сохранить изменения"
        onSubmit={handleSave}
      />

      <div className={styles.lessonSection}>
        <LessonList course={course} />
      </div>

      <Modal
        isOpen={confirmation !== null}
        title={
          confirmation === "delete" ? "Удалить курс" : "Архивировать курс"
        }
        onClose={() => {
          if (!isActionLoading) {
            setConfirmation(null);
            setActionError(null);
          }
        }}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={isActionLoading}
              onClick={() => {
                setConfirmation(null);
                setActionError(null);
              }}
            >
              Отмена
            </Button>
            <Button
              variant={confirmation === "delete" ? "danger" : "primary"}
              isLoading={isActionLoading}
              onClick={() => void confirmAction()}
            >
              {confirmation === "delete" ? "Удалить" : "Архивировать"}
            </Button>
          </>
        }
      >
        <p>
          {confirmation === "delete"
            ? `Удалить курс «${course.title}»?`
            : `Архивировать курс «${course.title}»?`}
        </p>
        {actionError && <ActionError error={actionError} />}
      </Modal>
    </section>
  );
}
