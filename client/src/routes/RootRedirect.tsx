import { Navigate } from "react-router-dom";

import { ErrorState, Loader } from "../components/ui";
import { fetchSession } from "../features/auth/authSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { getStartPath } from "./startPath";

export function RootRedirect() {
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
