import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "./components/layout/AppLayout";
import { ErrorState, Loader } from "./components/ui";
import { ForbiddenPage } from "./pages/ForbiddenPage";
import { CourseCreatePage } from "./pages/CourseCreatePage";
import { CourseEditPage } from "./pages/CourseEditPage";
import { CourseListPage } from "./pages/CourseListPage";
import { LessonCreatePage } from "./pages/LessonCreatePage";
import { LessonEditPage } from "./pages/LessonEditPage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProfileEditPage } from "./pages/ProfileEditPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RegisterPage } from "./pages/RegisterPage";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { getStartPath } from "./routes/startPath";
import { fetchSession } from "./features/auth/authSlice";
import { useAppDispatch, useAppSelector } from "./store/hooks";

function RootRedirect() {
  const dispatch = useAppDispatch();
  const { status, user } = useAppSelector((state) => state.auth);

  if (status === "idle" || status === "loading") {
    return <Loader />;
  }

  if (status === "error") {
    return <ErrorState onRetry={() => void dispatch(fetchSession())} />;
  }

  if (status === "authenticated" && user) {
    return <Navigate to={getStartPath(user.role)} replace />;
  }

  return <Navigate to="/login" replace />;
}

function PublicNotFoundPage() {
  return (
    <main>
      <NotFoundPage />
    </main>
  );
}

export function App() {
  const status = useAppSelector((state) => state.auth.status);
  const isAuthenticated = status === "authenticated";

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forbidden" element={<ForbiddenPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/profile/edit" element={<ProfileEditPage />} />
            <Route element={<ProtectedRoute roles={["teacher", "admin"]} />}>
              <Route path="/manage/courses" element={<CourseListPage />} />
              <Route
                path="/manage/courses/new"
                element={<CourseCreatePage />}
              />
              <Route
                path="/manage/courses/:courseId/edit"
                element={<CourseEditPage />}
              />
              <Route
                path="/manage/courses/:courseId/lessons/new"
                element={<LessonCreatePage />}
              />
              <Route
                path="/manage/lessons/:lessonId/edit"
                element={<LessonEditPage />}
              />
            </Route>
            {isAuthenticated && <Route path="*" element={<NotFoundPage />} />}
          </Route>
        </Route>
        {!isAuthenticated && (
          <Route
            path="*"
            element={
              status === "idle" || status === "loading" ? (
                <Loader />
              ) : (
                <PublicNotFoundPage />
              )
            }
          />
        )}
      </Routes>
    </BrowserRouter>
  );
}
