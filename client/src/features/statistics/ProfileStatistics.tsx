import { useEffect } from "react";

import { EmptyState, ErrorState, Loader } from "../../components/ui";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { fetchMyStatistics } from "./statisticsApi";
import { CourseStatisticsTable, TestResultsTable } from "./StatisticsTables";
import styles from "./Statistics.module.css";

export function ProfileStatistics() {
  const dispatch = useAppDispatch();
  const me = useAppSelector((state) => state.statistics.me);

  useEffect(() => {
    const request = dispatch(fetchMyStatistics());
    return () => request.abort();
  }, [dispatch]);

  return (
    <section className={styles.block}>
      <h2>Моя статистика</h2>
      {(me.status === "idle" || me.status === "loading") && (
        <Loader label="Загрузка личной статистики" />
      )}
      {me.status === "error" && (
        <ErrorState
          description={me.error?.message}
          onRetry={() => void dispatch(fetchMyStatistics())}
        />
      )}
      {me.status === "ready" && !me.data && (
        <EmptyState title="Статистики пока нет" />
      )}
      {me.status === "ready" && me.data && (
        <>
          <dl className={styles.cards}>
            <div>
              <dt>Время обучения</dt>
              <dd>{me.data.totalLearningMinutes} мин</dd>
            </div>
            <div>
              <dt>Завершено уроков</dt>
              <dd>{me.data.completedLessonsCount}</dd>
            </div>
            <div>
              <dt>Завершено курсов</dt>
              <dd>{me.data.completedCoursesCount}</dd>
            </div>
            <div>
              <dt>Общий прогресс</dt>
              <dd>{me.data.overallProgressPercent} %</dd>
            </div>
          </dl>
          <section>
            <h3>Активные и завершенные курсы</h3>
            <CourseStatisticsTable courses={me.data.courses} />
          </section>
          <section>
            <h3>Результаты тестов</h3>
            <TestResultsTable results={me.data.testResults} />
          </section>
          <section>
            <h3>Активность за последние четыре недели</h3>
            {me.data.activityWeeks.length === 0 && (
              <EmptyState title="Данных об активности пока нет" />
            )}
          </section>
        </>
      )}
    </section>
  );
}
