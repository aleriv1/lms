import { useEffect, useState, type ReactNode } from "react";
import {
  NavLink,
  Outlet,
  useLocation,
  useMatch,
  useNavigate,
} from "react-router-dom";

import { logout } from "../../features/auth/authSlice";
import { CourseNav } from "../../features/learning/CourseNav";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { Button, Loader } from "../ui";
import styles from "./AppLayout.module.css";
import { getNavItems, isNavItemActive, ROLE_LABELS } from "./navItems";

const NAVIGATION_ID = "app-navigation";
const LESSON_PATH = "/learning/courses/:courseId/lessons/:lessonId";
const TEST_PATH = "/learning/tests/:testId";
/**
 * The two rails remember their own state. Collapsing the menu on the catalogue
 * to gain width must not hide the course index a learner just gained, and a
 * focus-mode collapse while reading must not follow them onto the admin screens.
 */
const SIDEBAR_STORAGE_KEY = "lms.sidebar";
const COURSE_SIDEBAR_STORAGE_KEY = "lms.sidebar.course";

function readHidden(key: string) {
  try {
    return window.localStorage.getItem(key) === "hidden";
  } catch {
    return false;
  }
}

function useHiddenFlag(key: string) {
  const [isHidden, setIsHidden] = useState(() => readHidden(key));

  useEffect(() => {
    try {
      window.localStorage.setItem(key, isHidden ? "hidden" : "shown");
    } catch {
      // Private mode: the preference is simply not remembered.
    }
  }, [key, isHidden]);

  return [isHidden, setIsHidden] as const;
}

export function AppLayout({ children }: { children?: ReactNode }) {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const lessonMatch = useMatch(LESSON_PATH);
  const testMatch = useMatch(TEST_PATH);
  const testState = useAppSelector((state) => state.learning.test);
  const [isMenuHidden, setMenuHidden] = useHiddenFlag(SIDEBAR_STORAGE_KEY);
  const [isCourseNavHidden, setCourseNavHidden] = useHiddenFlag(
    COURSE_SIDEBAR_STORAGE_KEY,
  );

  // On a lesson the rail carries the course instead of the global menu: one
  // rail on screen, never two, and the lesson gets the page. A test belongs to
  // the same course, so it keeps the rail. Its route carries only the test id,
  // so which course that is arrives with the test the page loads — the rail
  // waits there rather than flashing the global menu in the meantime, and
  // steps aside for a test that fails to load, when the menu is the only way
  // out left.
  const testId = testMatch?.params.testId;
  const railTest =
    testId && testState.data?.id.toLowerCase() === testId.toLowerCase()
      ? testState.data
      : null;
  const courseRail = lessonMatch
    ? {
        courseId: lessonMatch.params.courseId ?? "",
        lessonId: lessonMatch.params.lessonId ?? "",
        isLessonOpen: true,
      }
    : testMatch && testState.status !== "error"
      ? {
          courseId: railTest?.courseId ?? "",
          lessonId: railTest?.lessonId ?? "",
          isLessonOpen: false,
        }
      : null;
  const isCourseMode = courseRail !== null;
  const isSidebarHidden = isCourseMode ? isCourseNavHidden : isMenuHidden;
  const setSidebarHidden = isCourseMode ? setCourseNavHidden : setMenuHidden;
  const hideLabel = isCourseMode ? "Скрыть оглавление курса" : "Скрыть меню";
  const showLabel = isCourseMode ? "Показать оглавление курса" : "Показать меню";

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
          aria-label={isMenuOpen ? hideLabel : showLabel}
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
        aria-label={showLabel}
        title={showLabel}
        onClick={() => setSidebarHidden(false)}
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
              aria-label={hideLabel}
              title={hideLabel}
              onClick={() => setSidebarHidden(true)}
            >
              <SidebarIcon isHidden={false} />
            </Button>
          </div>
          {!isCourseMode && (
            <>
              <p className={styles.userName}>{user.name}</p>
              <p className={styles.role}>{ROLE_LABELS[user.role]}</p>
            </>
          )}
        </div>
        {courseRail ? (
          <CourseNav
            navId={NAVIGATION_ID}
            courseId={courseRail.courseId}
            currentLessonId={courseRail.lessonId}
            isCurrentLessonOpen={courseRail.isLessonOpen}
            onNavigate={() => setIsMenuOpen(false)}
          />
        ) : (
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
        )}
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
