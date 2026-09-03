import type { CourseListItem } from "@lms/shared";
import { useEffect } from "react";
import { Link, Navigate } from "react-router-dom";

import { EmptyState, ErrorState, Loader, Table } from "../components/ui";
import type { TableColumn } from "../components/ui/Table/Table";
import { COURSE_STATUS_LABELS } from "../features/courses/courseLabels";
import { fetchDashboard } from "../features/statistics/statisticsApi";
import styles from "../features/statistics/Statistics.module.css";
import { useAppDispatch, useAppSelector } from "../store/hooks";

const columns: TableColumn<CourseListItem>[] = [
  {
    key: "title",
    header: "Название",
    render: (course) => (
      <Link to={`/manage/courses/${course.id}/edit`}>{course.title}</Link>
    ),
  },
  { key: "author", header: "Автор", render: (course) => course.author.name },
  { key: "lessons", header: "Уроков", render: (course) => course.lessonsCount },
  {
    key: "status",
    header: "Статус",
    render: (course) => COURSE_STATUS_LABELS[course.status],
  },
];

export function AdminDashboardPage() {
  const dispatch = useAppDispatch();
  const dashboard = useAppSelector((state) => state.statistics.dashboard);

  useEffect(() => {
    const request = dispatch(fetchDashboard());
    return () => request.abort();
  }, [dispatch]);

  if (dashboard.status === "idle" || dashboard.status === "loading") {
    return <Loader label="Загрузка главной страницы" />;
  }
  if (dashboard.status === "error") {
    if (dashboard.error?.code === "forbidden")
      return <Navigate to="/forbidden" replace />;
    return (
      <ErrorState
        description={dashboard.error?.message}
        onRetry={() => void dispatch(fetchDashboard())}
      />
    );
  }
  const data = dashboard.data;
  if (!data) return <EmptyState title="Статистики пока нет" />;

  return (
    <section className={styles.page}>
      <h1>Главная администратора</h1>
      <dl className={styles.cards}>
        <div>
          <dt>Активных курсов (опубликованных)</dt>
          <dd>{data.activeCoursesCount}</dd>
        </div>
        <div>
          <dt>Пользователей</dt>
          <dd>{data.usersCount}</dd>
        </div>
        <div>
          <dt>Тестов</dt>
          <dd>{data.testsCount}</dd>
        </div>
        <div>
          <dt>Активных назначений</dt>
          <dd>{data.activeAssignmentsCount}</dd>
        </div>
        <div>
          <dt>Новых пользователей за 7 дней</dt>
          <dd>{data.newUsersLast7DaysCount}</dd>
        </div>
        <div>
          <dt>Завершений курсов</dt>
          <dd>{data.completedCoursesCount}</dd>
        </div>
        <div>
          <dt>Средний прогресс обучающихся</dt>
          <dd>
            {data.averageProgressPercent} %
            <p className={styles.note}>
              по пользователям, у которых есть назначения
            </p>
          </dd>
        </div>
      </dl>
      <section>
        <h2>Быстрые действия</h2>
        <nav className={styles.links} aria-label="Быстрые действия">
          <Link to="/manage/courses/new">Создать курс</Link>
          <Link to="/admin/users">Управление пользователями</Link>
          <Link to="/admin/statistics">Статистика</Link>
        </nav>
      </section>
      <section>
        <h2>Недавно созданные курсы</h2>
        {data.recentCourses.length === 0 ? (
          <EmptyState title="Курсов пока нет" />
        ) : (
          <Table
            caption="Недавно созданные курсы"
            columns={columns}
            rows={data.recentCourses}
            getRowKey={(course) => course.id}
          />
        )}
      </section>
    </section>
  );
}
