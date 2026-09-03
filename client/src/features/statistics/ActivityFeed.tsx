import type { ActivityEvent } from "@lms/shared";

import { EmptyState } from "../../components/ui";
import { formatDateTime } from "../users/userFormat";
import { ACTIVITY_EVENT_LABELS } from "./statisticsFormat";
import styles from "./Statistics.module.css";

export type ActivityFeedProps = { events: ActivityEvent[] };

export function ActivityFeed({ events }: ActivityFeedProps) {
  if (events.length === 0) {
    return <EmptyState title="Данных об активности пока нет" />;
  }

  return (
    <ol className={styles.activityFeed}>
      {events.map((event) => (
        <li key={event.id} className={styles.activityEvent}>
          <strong>{ACTIVITY_EVENT_LABELS[event.type]}</strong>
          <span>{event.lessonTitle ?? event.courseTitle ?? "—"}</span>
          <time className={styles.note} dateTime={event.createdAt}>
            {formatDateTime(event.createdAt)}
          </time>
        </li>
      ))}
    </ol>
  );
}
