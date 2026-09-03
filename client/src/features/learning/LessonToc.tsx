import type { LearningLessonItem } from "@lms/shared";
import { Link } from "react-router-dom";

import { EmptyState, Table } from "../../components/ui";
import type { TableColumn } from "../../components/ui/Table/Table";
import { formatMinutes, LESSON_ACCESS_STATE_LABELS } from "./learningFormat";
import styles from "./LessonToc.module.css";

export type LessonTocProps = {
  courseId: string;
  lessons: LearningLessonItem[];
  currentLessonId?: string;
};

export function LessonToc({
  courseId,
  lessons,
  currentLessonId,
}: LessonTocProps) {
  const columns: TableColumn<LearningLessonItem>[] = [
    { key: "order", header: "№", render: (lesson) => lesson.order },
    {
      key: "title",
      header: "Название",
      render: (lesson) => {
        if (lesson.id.toLowerCase() === currentLessonId?.toLowerCase()) {
          return (
            <span className={styles.current} aria-current="step">
              {lesson.title}
              <span className={styles.mark}>Текущий урок</span>
            </span>
          );
        }
        return lesson.state === "locked" ? (
          <span>{lesson.title}</span>
        ) : (
          <Link to={`/learning/courses/${courseId}/lessons/${lesson.id}`}>
            {lesson.title}
          </Link>
        );
      },
    },
    {
      key: "required",
      header: "Обязательность",
      render: (lesson) =>
        lesson.isRequired ? "Обязательный" : "Необязательный",
    },
    {
      key: "duration",
      header: "Длительность",
      render: (lesson) => formatMinutes(lesson.durationMinutes),
    },
    {
      key: "state",
      header: "Состояние",
      render: (lesson) => LESSON_ACCESS_STATE_LABELS[lesson.state],
    },
    {
      key: "test",
      header: "Тест",
      render: (lesson) => (lesson.hasTest ? "Есть тест" : "—"),
    },
  ];

  return (
    <section className={styles.section}>
      <h2>Оглавление курса</h2>
      {lessons.length === 0 ? (
        <EmptyState
          title="Уроков пока нет"
          description="В курсе пока нет опубликованных уроков."
        />
      ) : (
        <Table
          caption="Уроки курса"
          columns={columns}
          rows={lessons}
          getRowKey={(lesson) => lesson.id}
        />
      )}
    </section>
  );
}
