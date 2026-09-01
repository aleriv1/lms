import { PAGE_SIZES } from "@lms/shared";

import { Button } from "../Button/Button";
import { Select } from "../Select/Select";
import styles from "./Pagination.module.css";

export type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

const pageSizeOptions = PAGE_SIZES.map((pageSize) => ({
  value: String(pageSize),
  label: String(pageSize),
}));

export function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  if (total <= pageSize) {
    return null;
  }

  return (
    <nav className={styles.pagination} aria-label="Пагинация">
      <div className={styles.controls}>
        <Button
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Назад
        </Button>
        <span>
          Страница {page} из {totalPages}
        </span>
        <Button
          variant="secondary"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Вперёд
        </Button>
      </div>
      <p>Всего: {total}</p>
      <Select
        className={styles.select}
        label="На странице"
        options={pageSizeOptions}
        value={String(pageSize)}
        onChange={(event) => onPageSizeChange(Number(event.target.value))}
      />
    </nav>
  );
}
