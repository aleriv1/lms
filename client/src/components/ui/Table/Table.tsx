import type { ReactNode } from "react";

import styles from "./Table.module.css";

export type TableColumn<TRow> = {
  key: string;
  header: string;
  /**
   * Класс для ячеек колонки. Нужен там, где содержимое — одно длинное «слово»
   * (почта, идентификатор): без переноса внутри слова колонка требует всю свою
   * ширину, и таблица уезжает в горизонтальный скролл.
   */
  className?: string;
  render: (row: TRow) => ReactNode;
};

export type TableProps<TRow> = {
  caption: string;
  columns: TableColumn<TRow>[];
  rows: TRow[];
  getRowKey: (row: TRow) => string;
};

export function Table<TRow>({
  caption,
  columns,
  rows,
  getRowKey,
}: TableProps<TRow>) {
  return (
    <div className={styles.container}>
      <table className={styles.table}>
        <caption className={styles.caption}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)}>
              {columns.map((column) => (
                <td
                  className={column.className}
                  data-label={column.header}
                  key={column.key}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
