import { zodResolver } from "@hookform/resolvers/zod";
import { registerBodySchema } from "@lms/shared";
import type { RegisterBody } from "@lms/shared";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { FieldPath } from "react-hook-form";
import { Link, Navigate } from "react-router-dom";

import { Button, Input, Loader } from "../components/ui";
import { register } from "../features/auth/authSlice";
import { getStartPath } from "../routes/startPath";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import styles from "./AuthForm.module.css";

export function RegisterPage() {
  const dispatch = useAppDispatch();
  const { status, user } = useAppSelector((state) => state.auth);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register: registerField,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isValid },
  } = useForm<RegisterBody>({
    resolver: zodResolver(registerBodySchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      password: "",
      passwordConfirm: "",
    },
  });

  if ((status === "idle" || status === "loading") && !isSubmitting) {
    return <Loader />;
  }

  if (status === "authenticated" && user) {
    return <Navigate to={getStartPath(user.role)} replace />;
  }

  const onSubmit = handleSubmit(async (body) => {
    setServerError(null);
    const result = await dispatch(register(body));

    if (register.fulfilled.match(result)) {
      return;
    }

    const formError = result.payload ?? {
      code: "internal_error" as const,
      message: "Произошла внутренняя ошибка",
    };
    setServerError(formError.message);
    for (const fieldError of formError.fields ?? []) {
      setError(fieldError.field as FieldPath<RegisterBody>, {
        type: "server",
        message: fieldError.message,
      });
    }
  });

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.heading}>
          <h1>Регистрация</h1>
          <p>Создайте учетную запись обучающегося</p>
        </div>
        <form className={styles.form} noValidate onSubmit={onSubmit}>
          <Input
            label="Имя"
            autoComplete="name"
            isRequired
            error={errors.name?.message}
            {...registerField("name")}
          />
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
            autoComplete="new-password"
            isRequired
            error={errors.password?.message}
            {...registerField("password")}
          />
          <Input
            label="Повторите пароль"
            type="password"
            autoComplete="new-password"
            isRequired
            error={errors.passwordConfirm?.message}
            {...registerField("passwordConfirm")}
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
            Зарегистрироваться
          </Button>
        </form>
        <p className={styles.footer}>
          Уже есть учетная запись?{" "}
          <Link className={styles.link} to="/login">
            Войти
          </Link>
        </p>
      </section>
    </main>
  );
}
