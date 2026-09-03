import type { LearnerCourseStat, TestAttemptSummary } from "@lms/shared";

import { EmptyState, ProgressBar, Table } from "../../components/ui";
import type { TableColumn } from "../../components/ui/Table/Table";
import { ASSIGNMENT_STATUS_LABELS, formatDateTime } from "../users/userFormat";
import styles from "./Statistics.module.css";

const courseColumns: TableColumn<LearnerCourseStat>[] = [
  { key: "title", header: "Курс", render: (course) => course.title },
  {
    key: "status",
    header: "Назначение",
    render: (course) => ASSIGNMENT_STATUS_LABELS[course.assignmentStatus],
  },
  {
    key: "progress",
    header: "Прогресс",
    render: (course) => (
      <ProgressBar
        value={course.progressPercent}
        label={
          course.assignmentStatus === "revoked"
            ? "Снято — текущий прогресс"
            : "Прогресс курса"
        }
      />
    ),
  },
  {
    key: "completedAt",
    header: "Дата завершения",
    render: (course) =>
      course.completedAt ? formatDateTime(course.completedAt) : "—",
  },
];

const testColumns: TableColumn<TestAttemptSummary>[] = [
  {
    key: "test",
    header: "Тест",
    render: (attempt) => (
      <>
        <div>{attempt.testTitle}</div>
        <div className={styles.note}>{attempt.courseTitle}</div>
        <div className={styles.marks}>
          {attempt.isLast && <span>Последняя</span>}
          {attempt.isBest && <span>Лучшая</span>}
        </div>
      </>
    ),
  },
  {
    key: "date",
    header: "Дата",
    render: (attempt) => formatDateTime(attempt.submittedAt),
  },
  { key: "score", header: "Балл", render: (attempt) => `${attempt.score} %` },
  {
    key: "status",
    header: "Статус",
    render: (attempt) => (attempt.passed ? "Пройден" : "Не пройден"),
  },
  {
    key: "attempt",
    header: "Номер попытки",
    render: (attempt) => attempt.attemptNumber,
  },
];

export function CourseStatisticsTable({
  courses,
}: {
  courses: LearnerCourseStat[];
}) {
  return courses.length === 0 ? (
    <EmptyState title="Назначенных курсов пока нет" />
  ) : (
    <Table
      caption="Назначенные курсы"
      columns={courseColumns}
      rows={courses}
      getRowKey={(course) => course.courseId}
    />
  );
}

export function TestResultsTable({
  results,
}: {
  results: TestAttemptSummary[];
}) {
  return results.length === 0 ? (
    <EmptyState title="Результатов тестов пока нет" />
  ) : (
    <Table
      caption="Последние и лучшие попытки"
      columns={testColumns}
      rows={results}
      getRowKey={(attempt) => attempt.id}
    />
  );
}
