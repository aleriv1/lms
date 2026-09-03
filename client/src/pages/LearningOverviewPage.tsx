import { useEffect } from "react";

import { EmptyState, ErrorState, Loader, ProgressBar } from "../components/ui";
import { CourseCard } from "../features/learning/CourseCard";
import { formatMinutes } from "../features/learning/learningFormat";
import { fetchLearningOverview } from "../features/learning/learningSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import styles from "./LearningOverviewPage.module.css";

export function LearningOverviewPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const overview = useAppSelector((state) => state.learning.overview);

  useEffect(() => {
    const request = dispatch(fetchLearningOverview());
    return () => request.abort();
  }, [dispatch]);

  if (overview.status === "error") {
    return (
      <ErrorState
        description={overview.error?.message}
        onRetry={() => void dispatch(fetchLearningOverview())}
      />
    );
  }
  if (!overview.data) return <Loader label="Загрузка обучения" />;

  const data = overview.data;
  return (
    <section className={styles.page}>
      <header>
        <h1>Мое обучение</h1>
        <p>Здравствуйте, {user?.name}!</p>
      </header>
      <div className={styles.figures}>
        <div className={styles.figure}>
          <p>Назначено курсов</p>
          <strong>{data.assignedCoursesCount}</strong>
        </div>
        <div className={styles.figure}>
          <p>Суммарное время обучения</p>
          <strong>{formatMinutes(data.totalLearningMinutes)}</strong>
        </div>
        <div className={styles.figure}>
          <ProgressBar
            value={data.overallProgressPercent}
            label="Общий прогресс"
          />
        </div>
      </div>
      <section>
        <h2>Назначенные курсы</h2>
        {data.courses.length === 0 ? (
          <EmptyState
            title="Вам пока не назначены курсы"
            description="Когда вам назначат обучение, курсы появятся здесь."
          />
        ) : (
          <div className={styles.courses}>
            {data.courses.map((card) => (
              <CourseCard key={card.courseId} card={card} />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
