import { zodResolver } from "@hookform/resolvers/zod";
import { changePasswordBodySchema, updateProfileBodySchema } from "@lms/shared";
import type { ChangePasswordBody, UpdateProfileBody } from "@lms/shared";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { FieldPath } from "react-hook-form";
import { Link } from "react-router-dom";

import { Button, Input, Loader } from "../components/ui";
import { changePassword, updateProfile } from "../features/auth/authSlice";
import { UnsavedChangesGuard } from "../routes/UnsavedChangesGuard";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import styles from "./ProfileEditPage.module.css";

export function ProfileEditPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const profileForm = useForm<UpdateProfileBody>({
    resolver: zodResolver(updateProfileBodySchema),
    mode: "onChange",
    values: user ? { name: user.name, email: user.email } : undefined,
  });
  const passwordForm = useForm<ChangePasswordBody>({
    resolver: zodResolver(changePasswordBodySchema),
    mode: "onChange",
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      newPasswordConfirm: "",
    },
  });

  if (!user) {
    return <Loader />;
  }

  const submitProfile = profileForm.handleSubmit(async (body) => {
    setProfileError(null);
    setProfileSuccess(null);
    const result = await dispatch(updateProfile(body));

    if (updateProfile.fulfilled.match(result)) {
      profileForm.reset({
        name: result.payload.name,
        email: result.payload.email,
      });
      setProfileSuccess("Профиль сохранен");
      return;
    }

    const formError = result.payload ?? {
      code: "internal_error" as const,
      message: "Произошла внутренняя ошибка",
    };
    setProfileError(formError.message);
    for (const fieldError of formError.fields ?? []) {
      profileForm.setError(fieldError.field as FieldPath<UpdateProfileBody>, {
        type: "server",
        message: fieldError.message,
      });
    }
  });

  const submitPassword = passwordForm.handleSubmit(async (body) => {
    setPasswordError(null);
    setPasswordSuccess(null);
    const result = await dispatch(changePassword(body));

    if (changePassword.fulfilled.match(result)) {
      passwordForm.reset();
      setPasswordSuccess("Пароль изменен");
      return;
    }

    const formError = result.payload ?? {
      code: "internal_error" as const,
      message: "Произошла внутренняя ошибка",
    };
    setPasswordError(formError.message);
    for (const fieldError of formError.fields ?? []) {
      passwordForm.setError(fieldError.field as FieldPath<ChangePasswordBody>, {
        type: "server",
        message: fieldError.message,
      });
    }
  });

  return (
    <section>
      <Link className={styles.backLink} to="/profile">
        Назад в личный кабинет
      </Link>
      <h1>Редактирование профиля</h1>
      <div className={styles.forms}>
        <UnsavedChangesGuard
          when={
            (profileForm.formState.isDirty &&
              !profileForm.formState.isSubmitting) ||
            (passwordForm.formState.isDirty &&
              !passwordForm.formState.isSubmitting)
          }
        />
        <form className={styles.form} noValidate onSubmit={submitProfile}>
          <h2>Личные данные</h2>
          <Input
            label="Имя"
            autoComplete="name"
            isRequired
            error={profileForm.formState.errors.name?.message}
            {...profileForm.register("name")}
          />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            isRequired
            error={profileForm.formState.errors.email?.message}
            {...profileForm.register("email")}
          />
          {profileError && (
            <p className={styles.error} role="alert">
              {profileError}
            </p>
          )}
          {profileSuccess && (
            <p className={styles.success} role="status">
              {profileSuccess}
            </p>
          )}
          <Button
            type="submit"
            disabled={
              profileForm.formState.isSubmitting ||
              !profileForm.formState.isValid
            }
            isLoading={profileForm.formState.isSubmitting}
          >
            Сохранить профиль
          </Button>
        </form>

        <form className={styles.form} noValidate onSubmit={submitPassword}>
          <h2>Смена пароля</h2>
          <Input
            label="Текущий пароль"
            type="password"
            autoComplete="current-password"
            isRequired
            error={passwordForm.formState.errors.currentPassword?.message}
            {...passwordForm.register("currentPassword")}
          />
          <Input
            label="Новый пароль"
            type="password"
            autoComplete="new-password"
            isRequired
            error={passwordForm.formState.errors.newPassword?.message}
            {...passwordForm.register("newPassword")}
          />
          <Input
            label="Повторите новый пароль"
            type="password"
            autoComplete="new-password"
            isRequired
            error={passwordForm.formState.errors.newPasswordConfirm?.message}
            {...passwordForm.register("newPasswordConfirm")}
          />
          {passwordError && (
            <p className={styles.error} role="alert">
              {passwordError}
            </p>
          )}
          {passwordSuccess && (
            <p className={styles.success} role="status">
              {passwordSuccess}
            </p>
          )}
          <Button
            type="submit"
            disabled={
              passwordForm.formState.isSubmitting ||
              !passwordForm.formState.isValid
            }
            isLoading={passwordForm.formState.isSubmitting}
          >
            Изменить пароль
          </Button>
        </form>
      </div>
    </section>
  );
}
