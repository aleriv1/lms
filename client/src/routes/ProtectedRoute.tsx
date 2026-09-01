import type { UserRole } from "@lms/shared";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { ErrorState, Loader } from "../components/ui";
import { fetchSession } from "../features/auth/authSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";

export type ProtectedRouteProps = {
  roles?: UserRole[];
};

export function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const { status, user } = useAppSelector((state) => state.auth);

  if (status === "idle" || status === "loading") {
    return <Loader />;
  }

  if (status === "error") {
    return <ErrorState onRetry={() => void dispatch(fetchSession())} />;
  }

  if (status === "anonymous" || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <Outlet />;
}
