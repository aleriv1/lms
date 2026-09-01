import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "../components/ui";
import { logout } from "../features/auth/authSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import styles from "./ForbiddenPage.module.css";

export function ForbiddenPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const isAuthenticated = useAppSelector(
    (state) => state.auth.status === "authenticated",
  );
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleOtherAccount = async () => {
    setIsLoggingOut(true);
    await dispatch(logout());
    navigate("/login", { replace: true });
  };

  return (
    <main className={styles.page}>
      <p className={styles.code}>403</p>
      <h1>Нет доступа</h1>
      <p>У вашей учетной записи нет прав для просмотра этой страницы.</p>
      <div className={styles.actions}>
        <Link
          className={styles.link}
          to={isAuthenticated ? "/profile" : "/login"}
        >
          Вернуться
        </Link>
        <Button
          variant="secondary"
          disabled={isLoggingOut}
          isLoading={isLoggingOut}
          onClick={() => void handleOtherAccount()}
        >
          Войти под другой учетной записью
        </Button>
      </div>
    </main>
  );
}
