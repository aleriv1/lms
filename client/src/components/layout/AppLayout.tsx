import { useEffect, useState, type ReactNode } from "react";
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { logout } from "../../features/auth/authSlice";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { Button, Loader } from "../ui";
import styles from "./AppLayout.module.css";
import { getNavItems, isNavItemActive, ROLE_LABELS } from "./navItems";

const NAVIGATION_ID = "app-navigation";
const SIDEBAR_STORAGE_KEY = "lms.sidebar";

function readSidebarHidden() {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "hidden";
  } catch {
    return false;
  }
}

export function AppLayout({ children }: { children?: ReactNode }) {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarHidden, setIsSidebarHidden] = useState(readSidebarHidden);

  useEffect(() => {
    window.localStorage.setItem(
      SIDEBAR_STORAGE_KEY,
      isSidebarHidden ? "hidden" : "shown",
    );
  }, [isSidebarHidden]);

  if (!user) {
    return <Loader />;
  }

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await dispatch(logout());
    navigate("/login", { replace: true });
  };

  return (
    <div
      className={`${styles.layout} ${isSidebarHidden ? styles.withoutSidebar : ""}`}
    >
      <header className={styles.topbar}>
        <p className={styles.product}>Corporate Learning</p>
        <Button
          className={styles.menuToggle}
          variant="ghost"
          aria-controls={NAVIGATION_ID}
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? "Скрыть меню" : "Показать меню"}
          onClick={() => setIsMenuOpen((value) => !value)}
        >
          <MenuIcon isOpen={isMenuOpen} />
        </Button>
      </header>
      <Button
        className={`${styles.sidebarShow} ${
          isSidebarHidden ? styles.visible : ""
        }`}
        variant="secondary"
        aria-label="Показать меню"
        title="Показать меню"
        onClick={() => setIsSidebarHidden(false)}
      >
        <SidebarIcon isHidden />
      </Button>
      <aside
        className={`${styles.sidebar} ${isMenuOpen ? styles.open : ""} ${
          isSidebarHidden ? styles.hidden : ""
        }`}
      >
        <div>
          <div className={styles.sidebarHead}>
            <p className={styles.product}>Corporate Learning</p>
            <Button
              className={styles.sidebarHide}
              variant="ghost"
              aria-label="Скрыть меню"
              title="Скрыть меню"
              onClick={() => setIsSidebarHidden(true)}
            >
              <SidebarIcon isHidden={false} />
            </Button>
          </div>
          <p className={styles.userName}>{user.name}</p>
          <p className={styles.role}>{ROLE_LABELS[user.role]}</p>
        </div>
        <nav
          className={styles.navigation}
          id={NAVIGATION_ID}
          aria-label="Основная навигация"
        >
          {getNavItems(user).map((item) => (
            <NavLink
              className={() =>
                `${styles.navLink} ${
                  isNavItemActive(item, location.pathname, location.search)
                    ? styles.active
                    : ""
                }`
              }
              key={item.to}
              to={item.to}
              onClick={() => setIsMenuOpen(false)}
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
        {children ?? <Outlet />}
      </main>
    </div>
  );
}

function MenuIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <LayoutIcon>
      {isOpen ? (
        <path d="M6 6l12 12M18 6L6 18" />
      ) : (
        <path d="M4 7h16M4 12h16M4 17h16" />
      )}
    </LayoutIcon>
  );
}

function SidebarIcon({ isHidden }: { isHidden: boolean }) {
  return (
    <LayoutIcon>
      <path d="M4 5h16v14H4z" />
      <path d="M10 5v14" />
      {isHidden ? <path d="M14 9l3 3-3 3" /> : <path d="M17 9l-3 3 3 3" />}
    </LayoutIcon>
  );
}

function LayoutIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}
