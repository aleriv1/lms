import { zodResolver } from "@hookform/resolvers/zod";
import {
  LESSON_ORDER_MAX,
  LESSON_ORDER_MIN,
  RESOURCE_LINKS_MAX_COUNT,
  createLessonBodySchema,
  type CreateLessonBody,
} from "@lms/shared";
import { useEffect, useState } from "react";
import { useFieldArray, useForm, type FieldPath } from "react-hook-form";
import type { z } from "zod";

import type { FormError } from "../../api/formError";
import { UnsavedChangesGuard } from "../../routes/UnsavedChangesGuard";
import { Button, Checkbox, Input, Textarea } from "../../components/ui";
import styles from "./LessonForm.module.css";

export type LessonFormProps = {
  defaultValues?: Partial<CreateLessonBody>;
  submitLabel: string;
  onSubmit: (body: CreateLessonBody) => Promise<FormError | null>;
  /** Lets the page know there is unsaved input, so it can refuse to leave it behind. */
  onDirtyChange?: (isDirty: boolean) => void;
};

type LessonFormInput = z.input<typeof createLessonBodySchema>;

export function LessonForm({
  defaultValues,
  submitLabel,
  onSubmit,
  onDirtyChange,
}: LessonFormProps) {
  const [generalError, setGeneralError] = useState<string | null>(null);
  const form = useForm<LessonFormInput, unknown, CreateLessonBody>({
    resolver: zodResolver(createLessonBodySchema),
    mode: "onChange",
    defaultValues: {
      title: "",
      order: defaultValues?.order,
      durationMinutes: defaultValues?.durationMinutes ?? 1,
      content: "",
      ...defaultValues,
      videoUrl: defaultValues?.videoUrl ?? "",
      resourceLinks: defaultValues?.resourceLinks ?? [],
      isRequired: defaultValues?.isRequired ?? true,
      testId: null,
    },
  });
  const resourceLinks = useFieldArray({
    control: form.control,
    name: "resourceLinks",
  });

  const { isDirty } = form.formState;
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const submit = form.handleSubmit(async (body) => {
    setGeneralError(null);
    const error = await onSubmit(body);

    if (!error) {
      // What is on screen is now what is stored, so it is no longer unsaved
      // input. Reset from the raw values rather than the parsed body: the two
      // differ where the schema transforms, and the fields must not change
      // under the author after a successful save.
      form.reset(form.getValues());
      return;
    }

    setGeneralError(error.message);
    for (const fieldError of error.fields ?? []) {
      form.setError(fieldError.field as FieldPath<LessonFormInput>, {
        type: "server",
        message: fieldError.message,
      });
    }
  });

  return (
    <form className={styles.form} noValidate onSubmit={submit}>
      <UnsavedChangesGuard
        when={form.formState.isDirty && !form.formState.isSubmitting}
      />
      <Input
        label="Название"
        isRequired
        error={form.formState.errors.title?.message}
        {...form.register("title")}
      />
      <Input
        label="Порядковый номер"
        type="number"
        min={LESSON_ORDER_MIN}
        max={LESSON_ORDER_MAX}
        isRequired
        error={form.formState.errors.order?.message}
        {...form.register("order")}
      />
      <Input
        label="Длительность в минутах"
        type="number"
        isRequired
        error={form.formState.errors.durationMinutes?.message}
        {...form.register("durationMinutes")}
      />
      <Textarea
        label="Содержание"
        rows={16}
        isRequired
        error={form.formState.errors.content?.message}
        {...form.register("content")}
      />
      <Input
        label="URL внешнего видео"
        type="url"
        error={form.formState.errors.videoUrl?.message}
        {...form.register("videoUrl")}
      />

      <fieldset className={styles.resources}>
        <legend>Ссылки на материалы</legend>
        {resourceLinks.fields.map((field, index) => (
          <div className={styles.resourceRow} key={field.id}>
            <Input
              label="Название ссылки"
              error={
                form.formState.errors.resourceLinks?.[index]?.title?.message
              }
              {...form.register(`resourceLinks.${index}.title`)}
            />
            <Input
              label="URL ссылки"
              type="url"
              error={form.formState.errors.resourceLinks?.[index]?.url?.message}
              {...form.register(`resourceLinks.${index}.url`)}
            />
            <Button
              variant="danger"
              onClick={() => resourceLinks.remove(index)}
            >
              Удалить
            </Button>
          </div>
        ))}
        <Button
          variant="secondary"
          disabled={resourceLinks.fields.length >= RESOURCE_LINKS_MAX_COUNT}
          onClick={() => resourceLinks.append({ title: "", url: "" })}
        >
          Добавить ссылку
        </Button>
      </fieldset>

      <Checkbox
        label="Обязательный урок"
        error={form.formState.errors.isRequired?.message}
        {...form.register("isRequired")}
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
