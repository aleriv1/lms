import { zodResolver } from "@hookform/resolvers/zod";
import {
  submitAttemptBodySchema,
  type LearnerQuestion,
  type LearnerTest,
  type SubmitAttemptBody,
} from "@lms/shared";
import { useRef, useState } from "react";
import { Controller, useForm, useWatch, type FieldPath } from "react-hook-form";
import { Link } from "react-router-dom";

import { toFormError, type FormError } from "../../api/formError";
import { Button, EmptyState, Modal, ProgressBar } from "../../components/ui";
import { UnsavedChangesGuard } from "../../routes/UnsavedChangesGuard";
import styles from "./TestAttemptForm.module.css";

export type TestAttemptFormProps = {
  test: LearnerTest;
  onSubmit: (body: SubmitAttemptBody) => Promise<FormError | null>;
};

function ActionError({
  error,
  courseId,
}: {
  error: FormError;
  courseId: string;
}) {
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
      {error.code === "course_not_assigned" && (
        <Link to="/learning">Вернуться к обучению</Link>
      )}
      {(error.code === "forbidden" ||
        error.code === "lesson_locked" ||
        error.code === "not_found") && (
        <Link to={`/learning/courses/${courseId}`}>Вернуться к курсу</Link>
      )}
      {error.code === "conflict" && <p>Повторите отправку ответов.</p>}
    </div>
  );
}

export function TestAttemptForm({ test, onSubmit }: TestAttemptFormProps) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [unansweredCount, setUnansweredCount] = useState(0);
  const [actionError, setActionError] = useState<FormError | null>(null);
  const [isSending, setIsSending] = useState(false);
  const inFlight = useRef(false);
  const form = useForm<SubmitAttemptBody>({
    resolver: zodResolver(submitAttemptBodySchema),
    mode: "onChange",
    defaultValues: {
      answers: test.questions.map((question) => ({
        questionId: question.id,
        optionIds: [],
      })),
    },
  });
  const answers = useWatch({ control: form.control, name: "answers" });
  const answeredCount = answers.filter(
    (answer) => answer.optionIds.length > 0,
  ).length;
  const question: LearnerQuestion | undefined = test.questions[questionIndex];
  const isLastQuestion = questionIndex === test.questions.length - 1;

  const submit = async (confirmed = false) => {
    // Lock before async validation too: a submit event bypasses disabled buttons.
    if (inFlight.current || !isLastQuestion) return;
    inFlight.current = true;
    setIsSending(true);
    try {
      await form.handleSubmit(async (body) => {
        const unanswered = body.answers.filter(
          (answer) => answer.optionIds.length === 0,
        ).length;
        if (unanswered > 0 && !confirmed) {
          setUnansweredCount(unanswered);
          return;
        }
        setUnansweredCount(0);
        setActionError(null);
        const error = await onSubmit(body);
        if (!error) return;
        setActionError(error);
        for (const fieldError of error.fields ?? []) {
          form.setError(fieldError.field as FieldPath<SubmitAttemptBody>, {
            type: "server",
            message: fieldError.message,
          });
        }
      })();
    } catch (error) {
      setActionError(toFormError(error));
    } finally {
      inFlight.current = false;
      setIsSending(false);
    }
  };

  if (!question) return <EmptyState title="В тесте пока нет вопросов" />;

  return (
    <form
      className={styles.form}
      aria-label="Ответы на тест"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <UnsavedChangesGuard when={answeredCount > 0 && !isSending} />
      <p role="status">
        Вопрос {questionIndex + 1} из {test.questions.length}
      </p>
      <ProgressBar
        value={Math.round((answeredCount / test.questions.length) * 100)}
        label="Доля вопросов с ответом"
      />
      <Controller
        key={question.id}
        control={form.control}
        name={`answers.${questionIndex}.optionIds`}
        render={({ field, fieldState }) => (
          <fieldset
            className={styles.question}
            disabled={isSending || unansweredCount > 0}
            aria-describedby={
              fieldState.error ? `${question.id}-error` : undefined
            }
          >
            <legend className={styles.legend}>{question.text}</legend>
            <p>
              {question.type === "single"
                ? "Выберите один ответ"
                : "Выберите несколько ответов"}
            </p>
            {question.options.map((option, index) => (
              <label className={styles.option} key={option.id}>
                <input
                  type={question.type === "single" ? "radio" : "checkbox"}
                  name={field.name}
                  value={option.id}
                  checked={field.value.includes(option.id)}
                  ref={index === 0 ? field.ref : undefined}
                  onBlur={field.onBlur}
                  aria-invalid={Boolean(fieldState.error)}
                  onChange={(event) => {
                    field.onChange(
                      question.type === "single"
                        ? [option.id]
                        : event.target.checked
                          ? [...field.value, option.id]
                          : field.value.filter((id) => id !== option.id),
                    );
                  }}
                />
                <span>{option.text}</span>
              </label>
            ))}
            {fieldState.error && (
              <p
                id={`${question.id}-error`}
                className={styles.error}
                role="alert"
              >
                {fieldState.error.message}
              </p>
            )}
          </fieldset>
        )}
      />
      {actionError && (
        <ActionError error={actionError} courseId={test.courseId} />
      )}
      <div className={styles.actions}>
        <Button
          variant="secondary"
          disabled={questionIndex === 0 || isSending || unansweredCount > 0}
          onClick={() => setQuestionIndex((index) => index - 1)}
        >
          Назад
        </Button>
        {isLastQuestion ? (
          <Button
            type="submit"
            disabled={isSending || !form.formState.isValid}
            isLoading={isSending}
          >
            Отправить ответы
          </Button>
        ) : (
          <Button
            disabled={isSending || unansweredCount > 0}
            onClick={() => setQuestionIndex((index) => index + 1)}
          >
            Далее
          </Button>
        )}
      </div>
      <Modal
        isOpen={unansweredCount > 0}
        title="Отправить ответы?"
        onClose={() => {
          if (!inFlight.current) setUnansweredCount(0);
        }}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={isSending}
              onClick={() => setUnansweredCount(0)}
            >
              Вернуться к вопросам
            </Button>
            <Button
              disabled={isSending}
              isLoading={isSending}
              onClick={() => void submit(true)}
            >
              Подтвердить отправку
            </Button>
          </>
        }
      >
        <p>Вопросов без ответа: {unansweredCount}. Отправить попытку?</p>
      </Modal>
    </form>
  );
}
