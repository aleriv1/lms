import { AppLayout } from "../components/layout/AppLayout";
import { ErrorState, Loader } from "../components/ui";
import { fetchSession } from "../features/auth/authSlice";
import { NotFoundPage } from "../pages/NotFoundPage";
import { useAppDispatch, useAppSelector } from "../store/hooks";

export function NotFoundRoute() {
  const dispatch = useAppDispatch();
  const status = useAppSelector((state) => state.auth.status);

  if (status === "idle" || status === "loading") {
    return <Loader />;
  }

  if (status === "error") {
    return <ErrorState onRetry={() => void dispatch(fetchSession())} />;
  }

  if (status === "authenticated") {
    return (
      <AppLayout>
        <NotFoundPage />
      </AppLayout>
    );
  }

  return (
    <main>
      <NotFoundPage />
    </main>
  );
}
