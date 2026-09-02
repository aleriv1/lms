import type { CreateLessonBody, Lesson } from "@lms/shared";
import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import type { FormError } from "../api/formError";
import { Button, EmptyState, ErrorState, Loader, Modal } from "../components/ui";
import { LESSON_STATUS_LABELS } from "../features/lessons/lessonLabels";
import { LessonForm } from "../features/lessons/LessonForm";
import {
  deleteLesson,
  fetchLesson,
  publishLesson,
  unpublishLesson,
  updateLesson,
} from "../features/lessons/lessonsSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import styles from "./LessonEditPage.module.css";

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

function toFormValues(lesson: Lesson): CreateLessonBody {
  return {
    title: lesson.title,
    order: lesson.order,
    durationMinutes: lesson.durationMinutes,
    content: lesson.content,
    videoUrl: lesson.videoUrl,
    resourceLinks: lesson.resourceLinks,
    isRequired: lesson.isRequired,
    testId: null,
  };
}

const fallbackError: FormError = {
  code: "internal_error",
  message: "Произошла внутренняя ошибка",
};

export function LessonEditPage() {
  const { lessonId } = useParams();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const detail = useAppSelector((state) => state.lessons.detail);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<FormError | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    if (lessonId) {
      void dispatch(fetchLesson(lessonId));
    }
  }, [dispatch, lessonId]);

  if (!lessonId) {
    return <ErrorState description="Некорректный адрес урока" />;
  }

  if (detail.status === "idle" || detail.status === "loading") {
    return <Loader label="Загрузка урока" />;
  }

  if (detail.status === "error") {
    if (detail.error?.code === "forbidden") {
      return <Navigate to="/forbidden" replace />;
    }

    if (detail.error?.code === "not_found") {
      return (
        <EmptyState
          title="Урок не найден"
          description="Возможно, он был удален."
          action={<Link to="/manage/courses">Вернуться в каталог</Link>}
        />
      );
    }

    return (
      <ErrorState
        description={detail.error?.message}
        onRetry={() => void dispatch(fetchLesson(lessonId))}
      />
    );
  }

  const lesson = detail.lesson;
  if (!lesson || lesson.id !== lessonId) {
    return <ErrorState />;
  }

  const handleSave = async (
    body: CreateLessonBody,
  ): Promise<FormError | null> => {
    setSuccessMessage(null);
    setActionError(null);
    const result = await dispatch(
      updateLesson({ courseId: lesson.courseId, lessonId, body }),
    );

    if (updateLesson.fulfilled.match(result)) {
      setSuccessMessage("Изменения сохранены");
      return null;
    }

    return result.payload ?? fallbackError;
  };

  const handlePublication = async () => {
    setSuccessMessage(null);
    setActionError(null);
    setIsActionLoading(true);
    const result = await dispatch(
      lesson.status === "draft"
        ? publishLesson({ courseId: lesson.courseId, lessonId })
        : unpublishLesson({ courseId: lesson.courseId, lessonId }),
    );

    if (
      publishLesson.fulfilled.match(result) ||
      unpublishLesson.fulfilled.match(result)
    ) {
      await dispatch(fetchLesson(lessonId));
      setSuccessMessage(
        lesson.status === "draft"
          ? "Урок опубликован"
          : "Урок снят с публикации",
      );
      setIsActionLoading(false);
      return;
    }

    setActionError(result.payload ?? fallbackError);
    setIsActionLoading(false);
  };

  const confirmDelete = async () => {
    setSuccessMessage(null);
    setActionError(null);
    setIsActionLoading(true);
    const result = await dispatch(
      deleteLesson({ courseId: lesson.courseId, lessonId }),
    );
    setIsActionLoading(false);

    if (deleteLesson.rejected.match(result)) {
      setActionError(result.payload ?? fallbackError);
      return;
    }

    setIsDeleteOpen(false);
    navigate(`/manage/courses/${lesson.courseId}/edit`);
  };

  return (
    <section>
      <Link
        className={styles.backLink}
        to={`/manage/courses/${lesson.courseId}/edit`}
      >
        Назад к курсу
      </Link>
      <div className={styles.heading}>
        <div>
          <h1>Редактирование урока</h1>
          <p>Статус: {LESSON_STATUS_LABELS[lesson.status]}</p>
        </div>
        <div className={styles.actions}>
          <Button
            disabled={isActionLoading}
            onClick={() => void handlePublication()}
          >
            {lesson.status === "draft"
              ? "Опубликовать"
              : "Снять с публикации"}
          </Button>
          <Button
            variant="danger"
            disabled={isActionLoading}
            onClick={() => {
              setActionError(null);
              setIsDeleteOpen(true);
            }}
          >
            Удалить
          </Button>
        </div>
      </div>

      {successMessage && (
        <p className={styles.success} role="status">
          {successMessage}
        </p>
      )}
      {actionError && !isDeleteOpen && <ActionError error={actionError} />}

      <LessonForm
        key={lesson.id}
        defaultValues={toFormValues(lesson)}
        submitLabel="Сохранить изменения"
        onSubmit={handleSave}
      />

      <Modal
        isOpen={isDeleteOpen}
        title="Удалить урок"
        onClose={() => {
          if (!isActionLoading) {
            setIsDeleteOpen(false);
            setActionError(null);
          }
        }}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={isActionLoading}
              onClick={() => {
                setIsDeleteOpen(false);
                setActionError(null);
              }}
            >
              Отмена
            </Button>
            <Button
              variant="danger"
              isLoading={isActionLoading}
              onClick={() => void confirmDelete()}
            >
              Удалить
            </Button>
          </>
        }
      >
        <p>Удалить урок «{lesson.title}»?</p>
        {actionError && <ActionError error={actionError} />}
      </Modal>
    </section>
  );
}
