import { zodResolver } from "@hookform/resolvers/zod";
import {
  COURSE_AUDIENCES,
  createCourseBodySchema,
  type CreateCourseBody,
} from "@lms/shared";
import { useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import type { z } from "zod";

import type { FormError } from "../../api/formError";
import { Button, Input, Select, Textarea } from "../../components/ui";
import { COURSE_AUDIENCE_LABELS } from "./courseLabels";
import styles from "./CourseForm.module.css";

export type CourseFormProps = {
  defaultValues?: Partial<CreateCourseBody>;
  submitLabel: string;
  onSubmit: (body: CreateCourseBody) => Promise<FormError | null>;
};

const audienceOptions = COURSE_AUDIENCES.map((audience) => ({
  value: audience,
  label: COURSE_AUDIENCE_LABELS[audience],
}));

type CourseFormInput = z.input<typeof createCourseBodySchema>;

export function CourseForm({
  defaultValues,
  submitLabel,
  onSubmit,
}: CourseFormProps) {
  const [generalError, setGeneralError] = useState<string | null>(null);
  const form = useForm<CourseFormInput, unknown, CreateCourseBody>({
    resolver: zodResolver(createCourseBodySchema),
    mode: "onChange",
    defaultValues: {
      title: "",
      category: "",
      audience: "general",
      shortDescription: "",
      description: "",
      ...defaultValues,
      coverUrl: defaultValues?.coverUrl ?? "",
    },
  });

  const submit = form.handleSubmit(async (body) => {
    setGeneralError(null);
    const error = await onSubmit(body);

    if (!error) {
      return;
    }

    setGeneralError(error.message);
    for (const fieldError of error.fields ?? []) {
      form.setError(fieldError.field as FieldPath<CourseFormInput>, {
        type: "server",
        message: fieldError.message,
      });
    }
  });

  return (
    <form className={styles.form} noValidate onSubmit={submit}>
      <Input
        label="Название"
        isRequired
        error={form.formState.errors.title?.message}
        {...form.register("title")}
      />
      <Input
        label="Категория"
        isRequired
        error={form.formState.errors.category?.message}
        {...form.register("category")}
      />
      <Select
        label="Аудитория"
        isRequired
        options={audienceOptions}
        error={form.formState.errors.audience?.message}
        {...form.register("audience")}
      />
      <Textarea
        label="Краткое описание"
        isRequired
        rows={4}
        error={form.formState.errors.shortDescription?.message}
        {...form.register("shortDescription")}
      />
      <Textarea
        label="Полное описание"
        rows={10}
        error={form.formState.errors.description?.message}
        {...form.register("description")}
      />
      <Input
        label="URL обложки"
        type="url"
        error={form.formState.errors.coverUrl?.message}
        {...form.register("coverUrl")}
      />
      {generalError && (
        <p className={styles.error} role="alert">
          {generalError}
        </p>
      )}
      <Button
        type="submit"
        disabled={form.formState.isSubmitting || !form.formState.isValid}
        isLoading={form.formState.isSubmitting}
      >
        {submitLabel}
      </Button>
    </form>
  );
}
