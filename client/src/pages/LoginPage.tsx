import { loginBodySchema } from "@lms/shared";
import type { LoginBody } from "@lms/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { FieldPath } from "react-hook-form";
import { Link, Navigate, useLocation } from "react-router-dom";
import type { Location } from "react-router-dom";

import { Button, Input, Loader } from "../components/ui";
import { login } from "../features/auth/authSlice";
import { getStartPath } from "../routes/startPath";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import styles from "./AuthForm.module.css";

export function LoginPage() {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const { status, user } = useAppSelector((state) => state.auth);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register: registerField,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isValid },
  } = useForm<LoginBody>({
    resolver: zodResolver(loginBodySchema),
    mode: "onChange",
    defaultValues: { email: "", password: "" },
  });

  if ((status === "idle" || status === "loading") && !isSubmitting) {
    return <Loader />;
  }

  if (status === "authenticated" && user) {
    const from = (location.state as { from?: Location } | null)?.from;
    return <Navigate to={from ?? getStartPath(user.role)} replace />;
  }

  const onSubmit = handleSubmit(async (body) => {
    setServerError(null);
    const result = await dispatch(login(body));

    if (login.fulfilled.match(result)) {
      return;
    }

    const formError = result.payload ?? {
      code: "internal_error" as const,
      message: "Произошла внутренняя ошибка",
    };
    setServerError(formError.message);
    for (const fieldError of formError.fields ?? []) {
      setError(fieldError.field as FieldPath<LoginBody>, {
        type: "server",
        message: fieldError.message,
      });
    }
  });

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.heading}>
          <h1>Corporate Learning</h1>
          <p>Войдите в свою учетную запись</p>
        </div>
        <form className={styles.form} noValidate onSubmit={onSubmit}>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            isRequired
            error={errors.email?.message}
            {...registerField("email")}
          />
          <Input
            label="Пароль"
            type="password"
            autoComplete="current-password"
            isRequired
            error={errors.password?.message}
            {...registerField("password")}
          />
          {serverError && (
            <p className={styles.error} role="alert">
              {serverError}
            </p>
          )}
          <Button
            type="submit"
            disabled={isSubmitting || !isValid}
            isLoading={isSubmitting}
          >
            Войти
          </Button>
        </form>
        <p className={styles.footer}>
          Нет учетной записи?{" "}
          <Link className={styles.link} to="/register">
            Зарегистрироваться
          </Link>
        </p>
      </section>
    </main>
  );
}
