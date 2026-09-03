import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import { ROLE_LABELS } from "../components/layout/navItems";
import { EmptyState, ErrorState, Loader } from "../components/ui";
import { fetchUserStatistics } from "../features/statistics/statisticsApi";
import { ActivityFeed } from "../features/statistics/ActivityFeed";
import {
  CourseStatisticsTable,
  TestResultsTable,
} from "../features/statistics/StatisticsTables";
import styles from "../features/statistics/Statistics.module.css";
import { USER_STATUS_LABELS } from "../features/users/userFormat";
import { useAppDispatch, useAppSelector } from "../store/hooks";

export function AdminStatisticsUserPage() {
  const { userId } = useParams();
  const dispatch = useAppDispatch();
  const card = useAppSelector((state) => state.statistics.userCard);

  useEffect(() => {
    if (!userId) return;
    const request = dispatch(fetchUserStatistics(userId));
    return () => request.abort();
  }, [dispatch, userId]);

  const notFound = (
    <EmptyState
      title="404 — Пользователь не найден"
      description="Проверьте адрес или выберите пользователя в таблице."
      action={<Link to="/admin/statistics">Вернуться к статистике</Link>}
    />
  );
  if (!userId) return notFound;
  if (
    card.userId?.toLowerCase() !== userId.toLowerCase() ||
    card.status === "idle" ||
    card.status === "loading"
  ) {
    return <Loader label="Загрузка статистики пользователя" />;
  }
  if (card.status === "error") {
    if (card.error?.code === "forbidden")
      return <Navigate to="/forbidden" replace />;
    if (card.error?.code === "not_found") return notFound;
    return (
      <ErrorState
        description={card.error?.message}
        onRetry={() => void dispatch(fetchUserStatistics(userId))}
      />
    );
  }
  const data = card.data;
  if (!data || data.user.id.toLowerCase() !== userId.toLowerCase()) {
    return <Loader label="Загрузка статистики пользователя" />;
  }
  const user = data.user;

  return (
    <section className={styles.page}>
      <Link to="/admin/statistics">Назад к статистике</Link>
      <h1>Статистика: {user.name}</h1>
      <dl className={styles.identity}>
        <div>
          <dt>Email</dt>
          <dd>{user.email}</dd>
        </div>
        <div>
          <dt>Роль</dt>
          <dd>{ROLE_LABELS[user.role]}</dd>
        </div>
        <div>
          <dt>Группа</dt>
          <dd>{user.groupName ?? "Не указана"}</dd>
        </div>
        <div>
          <dt>Статус</dt>
          <dd>{USER_STATUS_LABELS[user.status]}</dd>
        </div>
      </dl>
      <Link to={`/admin/users/${user.id}`}>Управление учетной записью</Link>
      <dl className={styles.cards}>
        <div>
          <dt>Средний прогресс</dt>
          <dd>{data.averageProgressPercent} %</dd>
        </div>
        <div>
          <dt>Завершено курсов</dt>
          <dd>{data.completedCoursesCount}</dd>
        </div>
        <div>
          <dt>Время обучения</dt>
          <dd>{data.totalLearningMinutes} мин</dd>
        </div>
      </dl>
      <section>
        <h2>Назначенные курсы</h2>
        <CourseStatisticsTable courses={data.courses} />
      </section>
      <section>
        <h2>Результаты тестов</h2>
        <TestResultsTable results={data.testResults} />
      </section>
      <section>
        <h2>Последние учебные действия</h2>
        <ActivityFeed events={data.recentActivity} />
      </section>
    </section>
  );
}
