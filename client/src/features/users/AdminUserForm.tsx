import { zodResolver } from "@hookform/resolvers/zod";
import {
  GROUP_NAME_MAX_LENGTH,
  USER_ROLES,
  USER_STATUSES,
  adminUpdateUserBodySchema,
  type AdminUpdateUserBody,
  type AdminUserDetail,
} from "@lms/shared";
import { useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import type { z } from "zod";

import type { FormError } from "../../api/formError";
import { ROLE_LABELS } from "../../components/layout/navItems";
import { Button, Input, Modal, Select } from "../../components/ui";
import { USER_STATUS_LABELS } from "./userFormat";
import styles from "./AdminUserForm.module.css";

type AdminUserFormProps = {
  user: AdminUserDetail;
  isSelf: boolean;
  onSubmit: (body: AdminUpdateUserBody) => Promise<FormError | null>;
};

type AdminUserFormInput = z.input<typeof adminUpdateUserBodySchema>;

const roleOptions = USER_ROLES.map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
}));
const statusOptions = USER_STATUSES.map((status) => ({
  value: status,
  label: USER_STATUS_LABELS[status],
}));

function ActionError({ error }: { error: FormError }) {
  return (
    <div className={styles.error} role="alert">
      <p>{error.message}</p>
      {error.fields && (
        <ul>
          {error.fields.map((fieldError) => (
            <li key={`${fieldError.field}-${fieldError.message}`}>
              {fieldError.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AdminUserForm({ user, isSelf, onSubmit }: AdminUserFormProps) {
  const [confirmation, setConfirmation] = useState<AdminUpdateUserBody | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<FormError | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const form = useForm<AdminUserFormInput, unknown, AdminUpdateUserBody>({
    resolver: zodResolver(adminUpdateUserBodySchema),
    mode: "onChange",
    defaultValues: {
      name: user.name,
      role: user.role,
      groupName: user.groupName ?? "",
      status: user.status,
    },
  });

  const save = async (body: AdminUpdateUserBody) => {
    if (isSaving) return;
    setIsSaving(true);
    setActionError(null);
    setIsSaved(false);
    const error = await onSubmit(body);
    setIsSaving(false);

    if (!error) {
      form.reset(form.getValues());
      setConfirmation(null);
      setIsSaved(true);
      return;
    }

    setActionError(error);
    for (const fieldError of error.fields ?? []) {
      form.setError(fieldError.field as FieldPath<AdminUserFormInput>, {
        type: "server",
        message: fieldError.message,
      });
    }
  };

  const submit = form.handleSubmit(async (body) => {
    if (isSaving || confirmation) return;
    setActionError(null);
    setIsSaved(false);
    if (body.role !== user.role || body.status !== user.status) {
      setConfirmation(body);
      return;
    }
    await save(body);
  });

  return (
    <>
      {isSelf && <p>Собственные роль и статус изменить нельзя</p>}
      <form className={styles.form} noValidate onSubmit={submit}>
        <Input
          label="Имя"
          isRequired
          disabled={isSaving}
          error={form.formState.errors.name?.message}
          {...form.register("name")}
        />
        <Select
          label="Роль"
          isRequired
          options={roleOptions}
          disabled={isSaving}
          error={form.formState.errors.role?.message}
          {...form.register("role")}
        />
        <Input
          label="Группа"
          maxLength={GROUP_NAME_MAX_LENGTH}
          disabled={isSaving}
          error={form.formState.errors.groupName?.message}
          {...form.register("groupName")}
        />
        <Select
          label="Статус"
          isRequired
          options={statusOptions}
          disabled={isSaving}
          error={form.formState.errors.status?.message}
          {...form.register("status")}
        />
        {actionError && !confirmation && <ActionError error={actionError} />}
        {isSaved && <p role="status">Изменения сохранены</p>}
        <Button
          type="submit"
          disabled={
            form.formState.isSubmitting ||
            !form.formState.isValid ||
            confirmation !== null
          }
          isLoading={isSaving}
        >
          Сохранить изменения
        </Button>
      </form>
      <Modal
        isOpen={confirmation !== null}
        title="Подтвердить изменения"
        onClose={() => {
          if (!isSaving) setConfirmation(null);
        }}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={isSaving}
              onClick={() => setConfirmation(null)}
            >
              Отмена
            </Button>
            <Button
              isLoading={isSaving}
              onClick={() => {
                if (confirmation) void save(confirmation);
              }}
            >
              Сохранить
            </Button>
          </>
        }
      >
        <p>Сохранить изменения пользователя «{user.name}»?</p>
        {confirmation && confirmation.role !== user.role && (
          <p>
            Роль: {ROLE_LABELS[user.role]} → {ROLE_LABELS[confirmation.role]}
          </p>
        )}
        {confirmation && confirmation.status !== user.status && (
          <p>
            Статус: {USER_STATUS_LABELS[user.status]} →{" "}
            {USER_STATUS_LABELS[confirmation.status]}
          </p>
        )}
        {actionError && <ActionError error={actionError} />}
      </Modal>
    </>
  );
}
