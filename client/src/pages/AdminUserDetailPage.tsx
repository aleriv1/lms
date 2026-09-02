import type { AdminUpdateUserBody } from "@lms/shared";
import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import { toFormError, type FormError } from "../api/formError";
import { EmptyState, ErrorState, Loader } from "../components/ui";
import { AdminUserForm } from "../features/users/AdminUserForm";
import { AssignmentForm } from "../features/users/AssignmentForm";
import { AssignmentList } from "../features/users/AssignmentList";
import {
  fetchAdminUser,
  updateAdminUser,
} from "../features/users/adminUsersSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import styles from "./AdminUserDetailPage.module.css";

export function AdminUserDetailPage() {
  const { userId } = useParams();
  const dispatch = useAppDispatch();
  const detail = useAppSelector((state) => state.adminUsers.detail);
  const sessionUser = useAppSelector((state) => state.auth.user);

  useEffect(() => {
    if (userId) void dispatch(fetchAdminUser(userId));
  }, [dispatch, userId]);

  if (!userId) {
    return <ErrorState description="Некорректный адрес пользователя" />;
  }
  if (detail.status === "idle" || detail.status === "loading") {
    return <Loader label="Загрузка пользователя" />;
  }
  if (detail.status === "error") {
    if (detail.error?.code === "forbidden") {
      return <Navigate to="/forbidden" replace />;
    }
    if (detail.error?.code === "not_found") {
      return (
        <EmptyState
          title="404 — Пользователь не найден"
          description={detail.error.message}
          action={<Link to="/admin/users">Вернуться к пользователям</Link>}
        />
      );
    }
    return (
      <ErrorState
        description={detail.error?.message}
        onRetry={() => void dispatch(fetchAdminUser(userId))}
      />
    );
  }

  const user = detail.user;
  // The card of the previously opened user is still in the store until the load
  // effect runs, and that is a load, not a failure. The comparison is
  // case-insensitive: objectIdSchema accepts both cases of the same id, so a
  // hand-typed upper-case path would never match the id the server echoes back.
  if (!user || user.id.toLowerCase() !== userId.toLowerCase()) {
    return <Loader label="Загрузка пользователя" />;
  }

  const handleSave = async (
    body: AdminUpdateUserBody,
  ): Promise<FormError | null> => {
    const result = await dispatch(updateAdminUser({ userId, body }));
    if (updateAdminUser.fulfilled.match(result)) return null;
    return result.payload ?? toFormError(result.error);
  };

  return (
    <section className={styles.page}>
      <Link to="/admin/users">Назад к пользователям</Link>
      <div className={styles.heading}>
        <h1>{user.name}</h1>
        <p>{user.email}</p>
      </div>
      <section>
        <h2>Данные пользователя</h2>
        <AdminUserForm
          key={user.id}
          user={user}
          isSelf={sessionUser?.id === user.id}
          onSubmit={handleSave}
        />
      </section>
      <section>
        <h2>Назначить курс</h2>
        <AssignmentForm
          key={user.id}
          userId={user.id}
          assignments={user.assignments}
        />
      </section>
      <section>
        <h2>Назначения и история</h2>
        <AssignmentList
          key={user.id}
          userId={user.id}
          assignments={user.assignments}
        />
      </section>
    </section>
  );
}
