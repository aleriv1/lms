import type { LearnerCourseStat, TestAttemptSummary } from "@lms/shared";
import { Link } from "react-router-dom";

import { EmptyState, ProgressBar, Table } from "../../components/ui";
import type { TableColumn } from "../../components/ui/Table/Table";
import { ASSIGNMENT_STATUS_LABELS, formatDateTime } from "../users/userFormat";
import styles from "./Statistics.module.css";

/**
 * The same table serves the learner's own profile and an administrator reading
 * someone else's statistics. Only the first may open the course: `/learning`
 * answers for the signed-in user, so a link on the administrative page would
 * lead to a course that is not theirs.
 */
function buildCourseColumns(
  linkCourses: boolean,
): TableColumn<LearnerCourseStat>[] {
  return [
    {
      key: "title",
      header: "Курс",
      render: (course) =>
        // A revoked assignment keeps the row for history, and `/learning`
        // no longer lists the course, so it stays plain text.
        linkCourses && course.assignmentStatus !== "revoked" ? (
          <Link to={`/learning/courses/${course.courseId}`}>
            {course.title}
          </Link>
        ) : (
          course.title
        ),
    },
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
}

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
  linkCourses = false,
}: {
  courses: LearnerCourseStat[];
  linkCourses?: boolean;
}) {
  return courses.length === 0 ? (
    <EmptyState title="Назначенных курсов пока нет" />
  ) : (
    <Table
      caption="Назначенные курсы"
      columns={buildCourseColumns(linkCourses)}
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
