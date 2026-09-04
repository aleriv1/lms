import { createBrowserRouter } from "react-router-dom";

import { AppLayout } from "../components/layout/AppLayout";
import { AdminUserDetailPage } from "../pages/AdminUserDetailPage";
import { AdminUserListPage } from "../pages/AdminUserListPage";
import { AdminDashboardPage } from "../pages/AdminDashboardPage";
import { AdminStatisticsPage } from "../pages/AdminStatisticsPage";
import { AdminStatisticsUserPage } from "../pages/AdminStatisticsUserPage";
import { ForbiddenPage } from "../pages/ForbiddenPage";
import { CourseCreatePage } from "../pages/CourseCreatePage";
import { CourseEditPage } from "../pages/CourseEditPage";
import { CourseListPage } from "../pages/CourseListPage";
import { LessonCreatePage } from "../pages/LessonCreatePage";
import { LessonEditPage } from "../pages/LessonEditPage";
import { LearningOverviewPage } from "../pages/LearningOverviewPage";
import { LearningCoursePage } from "../pages/LearningCoursePage";
import { LearningLessonPage } from "../pages/LearningLessonPage";
import { LearningTestPage } from "../pages/LearningTestPage";
import { TestCreatePage } from "../pages/TestCreatePage";
import { TestEditPage } from "../pages/TestEditPage";
import { LoginPage } from "../pages/LoginPage";
import { ProfileEditPage } from "../pages/ProfileEditPage";
import { ProfilePage } from "../pages/ProfilePage";
import { RegisterPage } from "../pages/RegisterPage";
import { ProtectedRoute } from "./ProtectedRoute";
import { RootRedirect } from "./RootRedirect";
import { NotFoundRoute } from "./NotFoundRoute";

export const router = createBrowserRouter([
  { path: "/", element: <RootRedirect /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/forbidden", element: <ForbiddenPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/profile", element: <ProfilePage /> },
          { path: "/profile/edit", element: <ProfileEditPage /> },
          { path: "/learning", element: <LearningOverviewPage /> },
          { path: "/learning/courses/:courseId", element: <LearningCoursePage /> },
          {
            path: "/learning/courses/:courseId/lessons/:lessonId",
            element: <LearningLessonPage />,
          },
          { path: "/learning/tests/:testId", element: <LearningTestPage /> },
          {
            element: <ProtectedRoute roles={["teacher", "admin"]} />,
            children: [
              { path: "/manage/courses", element: <CourseListPage /> },
              { path: "/manage/courses/new", element: <CourseCreatePage /> },
              {
                path: "/manage/courses/:courseId/edit",
                element: <CourseEditPage />,
              },
              {
                path: "/manage/courses/:courseId/lessons/new",
                element: <LessonCreatePage />,
              },
              {
                path: "/manage/lessons/:lessonId/edit",
                element: <LessonEditPage />,
              },
              {
                path: "/manage/courses/:courseId/tests/new",
                element: <TestCreatePage />,
              },
              {
                path: "/manage/tests/:testId/edit",
                element: <TestEditPage />,
              },
            ],
          },
          {
            element: <ProtectedRoute roles={["admin"]} />,
            children: [
              { path: "/admin", element: <AdminDashboardPage /> },
              { path: "/admin/statistics", element: <AdminStatisticsPage /> },
              {
                path: "/admin/statistics/users/:userId",
                element: <AdminStatisticsUserPage />,
              },
              { path: "/admin/users", element: <AdminUserListPage /> },
              { path: "/admin/users/:userId", element: <AdminUserDetailPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundRoute /> },
]);
