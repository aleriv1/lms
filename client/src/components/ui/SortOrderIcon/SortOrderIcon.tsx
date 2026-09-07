/** Стрелка порядка сортировки: одна иконка на все списки с фильтрами. */
export function SortOrderIcon({ ascending }: { ascending: boolean }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ascending ? (
        <path d="M12 19V5m0 0-6 6m6-6 6 6" />
      ) : (
        <path d="M12 5v14m0 0 6-6m-6 6-6-6" />
      )}
    </svg>
  );
}
