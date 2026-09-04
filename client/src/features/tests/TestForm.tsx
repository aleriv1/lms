import { zodResolver } from "@hookform/resolvers/zod";
import {
  DEFAULT_PASSING_SCORE,
  PASSING_SCORE_MAX,
  PASSING_SCORE_MIN,
  QUESTION_OPTIONS_MIN_COUNT,
  TEST_QUESTIONS_MAX_COUNT,
  TEST_QUESTIONS_MIN_COUNT,
  createTestBodySchema,
  type CourseDetail,
  type CreateTestBody,
  type QuestionInput,
} from "@lms/shared";
import { useEffect, useState } from "react";
import { useFieldArray, useForm, type FieldPath } from "react-hook-form";
import type { z } from "zod";

import type { FormError } from "../../api/formError";
import { UnsavedChangesGuard } from "../../routes/UnsavedChangesGuard";
import { Button, Input, Select } from "../../components/ui";
import { QuestionFieldset } from "./QuestionFieldset";
import { canMoveQuestion, renumberQuestions } from "./questionOrdering";
import styles from "./TestForm.module.css";

export type TestFormProps = {
  defaultValues?: Partial<CreateTestBody>;
  submitLabel: string;
  onSubmit: (body: CreateTestBody) => Promise<FormError | null>;
  lessons: CourseDetail["lessons"];
  isFinalTestTaken: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
};

export type TestFormInput = z.input<typeof createTestBodySchema>;

function emptyQuestion(order: number): QuestionInput {
  return {
    text: "",
    type: "single",
    order,
    options: Array.from({ length: QUESTION_OPTIONS_MIN_COUNT }, () => ({
      text: "",
      isCorrect: false,
    })),
  };
}

export function TestForm({
  defaultValues,
  submitLabel,
  onSubmit,
  lessons,
  isFinalTestTaken,
  onDirtyChange,
}: TestFormProps) {
  const [generalError, setGeneralError] = useState<string | null>(null);
  const form = useForm<TestFormInput, unknown, CreateTestBody>({
    resolver: zodResolver(createTestBodySchema),
    mode: "onChange",
    defaultValues: {
      title: defaultValues?.title ?? "",
      lessonId: defaultValues?.lessonId ?? null,
      passingScore: defaultValues?.passingScore ?? DEFAULT_PASSING_SCORE,
      questions: renumberQuestions(
        defaultValues?.questions ?? [emptyQuestion(1)],
      ),
    },
  });
  const questions = useFieldArray({ control: form.control, name: "questions" });
  const { errors, isDirty, isSubmitting, isValid } = form.formState;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const renumber = () => {
    renumberQuestions(form.getValues("questions")).forEach(
      (question, index) => {
        form.setValue(`questions.${index}.order`, question.order, {
          shouldDirty: true,
        });
      },
    );
    void form.trigger("questions");
  };

  const appendQuestion = () => {
    questions.append(emptyQuestion(questions.fields.length + 1));
    renumber();
  };

  const removeQuestion = (index: number) => {
    questions.remove(index);
    renumber();
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    if (!canMoveQuestion(index, questions.fields.length, direction)) {
      return;
    }
    questions.swap(index, direction === "up" ? index - 1 : index + 1);
    renumber();
  };

  const submit = form.handleSubmit(async (body) => {
    setGeneralError(null);
    const error = await onSubmit(body);

    if (!error) {
      form.reset(form.getValues());
      return;
    }

    setGeneralError(error.message);
    for (const fieldError of error.fields ?? []) {
      form.setError(fieldError.field as FieldPath<TestFormInput>, {
        type: "server",
        message: fieldError.message,
      });
    }
  });

  const questionsError =
    errors.questions?.message ?? errors.questions?.root?.message;

  return (
    <form className={styles.form} noValidate onSubmit={submit}>
      <UnsavedChangesGuard
        when={form.formState.isDirty && !form.formState.isSubmitting}
      />
      <fieldset className={styles.fields} disabled={isSubmitting}>
        <legend className={styles.legend}>Параметры теста и вопросы</legend>
        <Input
          label="Название"
          isRequired
          error={errors.title?.message}
          {...form.register("title")}
        />
        <Select
          label="Связанный урок"
          error={errors.lessonId?.message}
          options={[
            { value: "", label: "Итоговый тест", disabled: isFinalTestTaken },
            ...lessons.map((lesson) => ({
              value: lesson.id,
              label: lesson.title,
              disabled:
                Boolean(lesson.testId) && lesson.id !== defaultValues?.lessonId,
            })),
          ]}
          {...form.register("lessonId", {
            setValueAs: (value) => (value === "" ? null : value),
          })}
        />
        <Input
          label="Проходной балл, %"
          type="number"
          min={PASSING_SCORE_MIN}
          max={PASSING_SCORE_MAX}
          isRequired
          error={errors.passingScore?.message}
          {...form.register("passingScore")}
        />

        <fieldset className={styles.group}>
          <legend>Вопросы</legend>
          {questions.fields.map((field, index) => (
            <QuestionFieldset
              key={field.id}
              control={form.control}
              register={form.register}
              errors={errors}
              index={index}
              canRemove={questions.fields.length > TEST_QUESTIONS_MIN_COUNT}
              canMoveUp={canMoveQuestion(index, questions.fields.length, "up")}
              canMoveDown={canMoveQuestion(
                index,
                questions.fields.length,
                "down",
              )}
              onRemove={() => removeQuestion(index)}
              onMoveUp={() => moveQuestion(index, "up")}
              onMoveDown={() => moveQuestion(index, "down")}
              onOptionsChange={() => {
                void form.trigger(`questions.${index}.options`);
              }}
            />
          ))}
          {questionsError && (
            <p className={styles.error} role="alert">
              {questionsError}
            </p>
          )}
          <Button
            variant="secondary"
            disabled={questions.fields.length >= TEST_QUESTIONS_MAX_COUNT}
            onClick={appendQuestion}
          >
            Добавить вопрос
          </Button>
        </fieldset>

        {generalError && (
          <p className={styles.error} role="alert">
            {generalError}
          </p>
        )}
        <Button
          type="submit"
          disabled={isSubmitting || !isValid}
          isLoading={isSubmitting}
        >
          {submitLabel}
        </Button>
      </fieldset>
    </form>
  );
}
