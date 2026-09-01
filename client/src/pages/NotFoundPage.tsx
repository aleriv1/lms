import { Link } from "react-router-dom";

import styles from "./NotFoundPage.module.css";

export function NotFoundPage() {
  return (
    <main className={styles.page}>
      <p className={styles.code}>404</p>
      <h1>Страница не найдена</h1>
      <p>Возможно, адрес указан неверно или страница была перемещена.</p>
      <Link className={styles.link} to="/">
        Вернуться на главную
      </Link>
    </main>
  );
}
