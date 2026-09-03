import type { AdminStatisticsRow } from "@lms/shared";

export function formatStatisticsProgress(row: AdminStatisticsRow): string {
  return row.activeCoursesCount === 0 && row.completedCoursesCount === 0
    ? "—"
    : `${row.averageProgressPercent} %`;
}
