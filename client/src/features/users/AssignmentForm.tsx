import { zodResolver } from "@hookform/resolvers/zod";
import {
  createAssignmentBodySchema,
  type Assignment,
  type CreateAssignmentBody,
} from "@lms/shared";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { toFormError } from "../../api/formError";
import {
  Button,
  EmptyState,
  ErrorState,
  Loader,
  Select,
} from "../../components/ui";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { createAssignment, fetchAssignableCourses } from "./adminUsersSlice";
import styles from "./AssignmentForm.module.css";

type AssignmentFormProps = {
  userId: string;
  assignments: Assignment[];
  /** Lets the page know there is unsaved input, so it can refuse to leave it behind. */
  onDirtyChange?: (isDirty: boolean) => void;
};

export function AssignmentForm({
  userId,
  assignments,
  onDirtyChange,
}: AssignmentFormProps) {
  const dispatch = useAppDispatch();
  const courses = useAppSelector((state) => state.adminUsers.assignableCourses);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const form = useForm<
    z.input<typeof createAssignmentBodySchema>,
    unknown,
    CreateAssignmentBody
  >({
    resolver: zodResolver(createAssignmentBodySchema),
    mode: "onChange",
    defaultValues: { courseId: "" },
  });

  useEffect(() => {
    void dispatch(fetchAssignableCourses());
  }, [dispatch]);

  const { isDirty, isSubmitting } = form.formState;
  useEffect(() => {
    onDirtyChange?.(isDirty && !isSubmitting);
  }, [isDirty, isSubmitting, onDirtyChange]);

  const submit = form.handleSubmit(async (body) => {
    setGeneralError(null);
    setIsSaved(false);
    const result = await dispatch(createAssignment({ userId, body }));
    if (createAssignment.fulfilled.match(result)) {
      form.reset({ courseId: "" });
      setIsSaved(true);
      return;
    }

    const error = result.payload ?? toFormError(result.error);
    setGeneralError(error.message);
    for (const fieldError of error.fields ?? []) {
      if (fieldError.field === "courseId") {
        form.setError("courseId", {
          type: "server",
          message: fieldError.message,
        });
      }
    }
  });

  if (courses.status === "idle" || courses.status === "loading") {
    return <Loader label="Загрузка доступных курсов" />;
  }
  if (courses.status === "error") {
    return (
      <ErrorState onRetry={() => void dispatch(fetchAssignableCourses())} />
    );
  }
  if (courses.items.length === 0) {
    return (
      <EmptyState
        title="Нет курсов для назначения"
        description="Назначать можно только опубликованные курсы."
      />
    );
  }

  const options = [
    { value: "", label: "Выберите курс" },
    ...courses.items.map((course) => ({
      value: course.id,
      label: course.title,
      disabled: assignments.some(
        (assignment) =>
          assignment.course.id === course.id && assignment.status === "active",
      ),
    })),
  ];

  return (
    <form className={styles.form} noValidate onSubmit={submit}>
      <Select
        label="Опубликованный курс"
        isRequired
        options={options}
        disabled={form.formState.isSubmitting}
        error={form.formState.errors.courseId?.message}
        {...form.register("courseId")}
      />
      {courses.total > courses.items.length && (
        <p>
          Список ограничен: показано {courses.items.length} из {courses.total}{" "}
          курсов.
        </p>
      )}
      {generalError && (
        <p className={styles.error} role="alert">
          {generalError}
        </p>
      )}
      {isSaved && <p role="status">Курс назначен</p>}
      <Button
        type="submit"
        disabled={form.formState.isSubmitting || !form.formState.isValid}
        isLoading={form.formState.isSubmitting}
      >
        Назначить курс
      </Button>
    </form>
  );
}
