import type { CourseDetail, LessonSummary } from "@lms/shared";
import { useState } from "react";
import { Link } from "react-router-dom";

import type { FormError } from "../../api/formError";
import {
  Button,
  EmptyState,
  Modal,
  Table,
} from "../../components/ui";
import type { TableColumn } from "../../components/ui/Table/Table";
import { useAppDispatch } from "../../store/hooks";
import { LESSON_STATUS_LABELS } from "./lessonLabels";
import { moveLesson, sortLessons } from "./lessonOrdering";
import {
  deleteLesson,
  publishLesson,
  reorderLessons,
  unpublishLesson,
} from "./lessonsSlice";
import styles from "./LessonList.module.css";

export type LessonListProps = { course: CourseDetail };

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

const fallbackError: FormError = {
  code: "internal_error",
  message: "Произошла внутренняя ошибка",
};

export function LessonList({ course }: LessonListProps) {
  const dispatch = useAppDispatch();
  const [actionError, setActionError] = useState<FormError | null>(null);
  const [lessonToDelete, setLessonToDelete] = useState<LessonSummary | null>(
    null,
  );
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const lessons = sortLessons(course.lessons);

  const handleMove = async (
    lessonId: string,
    direction: "up" | "down",
  ) => {
    const body = moveLesson(course.lessons, lessonId, direction);
    if (!body) {
      return;
    }

    setActionError(null);
    setIsReordering(true);
    const result = await dispatch(reorderLessons({ courseId: course.id, body }));
    setIsReordering(false);

    if (reorderLessons.rejected.match(result)) {
      setActionError(result.payload ?? fallbackError);
    }
  };

  const handlePublication = async (lesson: LessonSummary) => {
    setActionError(null);
    setIsActionLoading(true);
    const result = await dispatch(
      lesson.status === "draft"
        ? publishLesson({ courseId: course.id, lessonId: lesson.id })
        : unpublishLesson({ courseId: course.id, lessonId: lesson.id }),
    );
    setIsActionLoading(false);

    if (
      publishLesson.rejected.match(result) ||
      unpublishLesson.rejected.match(result)
    ) {
      setActionError(result.payload ?? fallbackError);
    }
  };

  const confirmDelete = async () => {
    if (!lessonToDelete) {
      return;
    }

    setActionError(null);
    setIsActionLoading(true);
    const result = await dispatch(
      deleteLesson({ courseId: course.id, lessonId: lessonToDelete.id }),
    );
    setIsActionLoading(false);

    if (deleteLesson.rejected.match(result)) {
      setActionError(result.payload ?? fallbackError);
      return;
    }

    setLessonToDelete(null);
  };

  const columns: TableColumn<LessonSummary>[] = [
    { key: "order", header: "№", render: (lesson) => lesson.order },
    {
      key: "title",
      header: "Название",
      render: (lesson) => (
        <Link to={`/manage/lessons/${lesson.id}/edit`}>{lesson.title}</Link>
      ),
    },
    {
      key: "duration",
      header: "Длительность",
      render: (lesson) => `${lesson.durationMinutes} мин`,
    },
    {
      key: "required",
      header: "Обязательный",
      render: (lesson) => (lesson.isRequired ? "Да" : "Нет"),
    },
    {
      key: "status",
      header: "Статус",
      render: (lesson) => LESSON_STATUS_LABELS[lesson.status],
    },
    {
      key: "actions",
      header: "Действия",
      render: (lesson) => (
        <div className={styles.rowActions}>
          <Button
            variant="secondary"
            disabled={
              isReordering ||
              isActionLoading ||
              moveLesson(course.lessons, lesson.id, "up") === null
            }
            onClick={() => void handleMove(lesson.id, "up")}
          >
            Вверх
          </Button>
          <Button
            variant="secondary"
            disabled={
              isReordering ||
              isActionLoading ||
              moveLesson(course.lessons, lesson.id, "down") === null
            }
            onClick={() => void handleMove(lesson.id, "down")}
          >
            Вниз
          </Button>
          <Button
            disabled={isActionLoading || isReordering}
            onClick={() => void handlePublication(lesson)}
          >
            {lesson.status === "draft"
              ? "Опубликовать"
              : "Снять с публикации"}
          </Button>
          <Button
            variant="danger"
            disabled={isActionLoading || isReordering}
            onClick={() => {
              setActionError(null);
              setLessonToDelete(lesson);
            }}
          >
            Удалить
          </Button>
        </div>
      ),
    },
  ];

  return (
    <section>
      <h2>Оглавление</h2>
      {actionError && !lessonToDelete && <ActionError error={actionError} />}
      {lessons.length === 0 ? (
        <EmptyState
          title="Уроков пока нет"
          description="Добавьте первый урок курса."
          action={
            <Link to={`/manage/courses/${course.id}/lessons/new`}>
              Добавить урок
            </Link>
          }
        />
      ) : (
        <>
          <div className={styles.toolbar}>
            <Link to={`/manage/courses/${course.id}/lessons/new`}>
              Добавить урок
            </Link>
          </div>
          <Table
            caption="Уроки курса"
            columns={columns}
            rows={lessons}
            getRowKey={(lesson) => lesson.id}
          />
        </>
      )}

      <Modal
        isOpen={lessonToDelete !== null}
        title="Удалить урок"
        onClose={() => {
          if (!isActionLoading) {
            setLessonToDelete(null);
            setActionError(null);
          }
        }}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={isActionLoading}
              onClick={() => {
                setLessonToDelete(null);
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
        <p>Удалить урок «{lessonToDelete?.title}»?</p>
        {actionError && <ActionError error={actionError} />}
      </Modal>
    </section>
  );
}
