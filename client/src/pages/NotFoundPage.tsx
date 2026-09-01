import { Link } from "react-router-dom";

import { useAppSelector } from "../store/hooks";
import styles from "./NotFoundPage.module.css";

export function NotFoundPage() {
  const isAuthenticated = useAppSelector(
    (state) => state.auth.status === "authenticated",
  );

  return (
    <section className={styles.page}>
      <p className={styles.code}>404</p>
      <h1>Страница не найдена</h1>
      <p>Возможно, адрес указан неверно или страница была перемещена.</p>
      <Link
        className={styles.link}
        to={isAuthenticated ? "/profile" : "/login"}
      >
        Вернуться на главную
      </Link>
    </section>
  );
}
