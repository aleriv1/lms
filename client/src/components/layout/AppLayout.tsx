import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { logout } from "../../features/auth/authSlice";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { Button, Loader } from "../ui";
import styles from "./AppLayout.module.css";
import { getNavItems, ROLE_LABELS } from "./navItems";

export function AppLayout() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (!user) {
    return <Loader />;
  }

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await dispatch(logout());
    navigate("/login", { replace: true });
  };

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div>
          <p className={styles.product}>Corporate Learning</p>
          <p className={styles.userName}>{user.name}</p>
          <p className={styles.role}>{ROLE_LABELS[user.role]}</p>
        </div>
        <nav className={styles.navigation} aria-label="Основная навигация">
          {getNavItems(user.role).map((item) => (
            <NavLink
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.active : ""}`
              }
              key={item.to}
              to={item.to}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <Button
          className={styles.logout}
          variant="ghost"
          disabled={isLoggingOut}
          isLoading={isLoggingOut}
          onClick={() => void handleLogout()}
        >
          Выйти
        </Button>
      </aside>
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}
