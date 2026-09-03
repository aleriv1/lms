import type { ActivityWeek } from "@lms/shared";

import { EmptyState } from "../../components/ui";
import { formatWeekStart } from "./statisticsFormat";
import styles from "./Statistics.module.css";

export type ActivityChartProps = { weeks: ActivityWeek[] };

export function ActivityChart({ weeks }: ActivityChartProps) {
  if (weeks.every((week) => week.count === 0)) {
    return <EmptyState title="Данных об активности пока нет" />;
  }

  const max = Math.max(...weeks.map((week) => week.count));

  return (
    <ul
      className={styles.activityChart}
      aria-label="Учебные действия за последние четыре недели"
    >
      {weeks.map((week) => (
        <li key={week.weekStart} className={styles.activityColumn}>
          <div className={styles.activityBarTrack} aria-hidden="true">
            <div
              className={styles.activityBar}
              style={{
                height: `${week.count === 0 ? 0 : Math.max(4, Math.round((week.count / max) * 100))}%`,
              }}
            />
          </div>
          <span>Действий: {week.count}</span>
          <time dateTime={week.weekStart}>
            {formatWeekStart(week.weekStart)}
          </time>
        </li>
      ))}
    </ul>
  );
}
