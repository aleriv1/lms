import {
  QUESTION_OPTIONS_MAX_COUNT,
  QUESTION_OPTIONS_MIN_COUNT,
  QUESTION_TYPES,
  type CreateTestBody,
} from "@lms/shared";
import { useId } from "react";
import {
  useFieldArray,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";

import { Button, Checkbox, Input, Select, Textarea } from "../../components/ui";
import type { TestFormInput } from "./TestForm";
import { QUESTION_TYPE_LABELS } from "./testLabels";
import styles from "./TestForm.module.css";

type QuestionFieldsetProps = {
  control: Control<TestFormInput, unknown, CreateTestBody>;
  register: UseFormRegister<TestFormInput>;
  errors: FieldErrors<TestFormInput>;
  index: number;
  canRemove: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onOptionsChange: () => void;
};

export function QuestionFieldset({
  control,
  register,
  errors,
  index,
  canRemove,
  canMoveUp,
  canMoveDown,
  onRemove,
  onMoveUp,
  onMoveDown,
  onOptionsChange,
}: QuestionFieldsetProps) {
  const options = useFieldArray({
    control,
    name: `questions.${index}.options`,
  });
  const optionsErrorId = useId();
  const questionErrors = errors.questions?.[index];
  const optionsError =
    questionErrors?.options?.message ?? questionErrors?.options?.root?.message;

  return (
    <fieldset className={styles.group}>
      <legend>Вопрос {index + 1}</legend>
      <input
        type="hidden"
        {...register(`questions.${index}.order`, { valueAsNumber: true })}
      />
      {questionErrors?.order?.message && (
        <p className={styles.error} role="alert">
          {questionErrors.order.message}
        </p>
      )}
      <Textarea
        label="Текст вопроса"
        isRequired
        error={questionErrors?.text?.message}
        {...register(`questions.${index}.text`)}
      />
      <Select
        label="Тип вопроса"
        options={QUESTION_TYPES.map((type) => ({
          value: type,
          label: QUESTION_TYPE_LABELS[type],
        }))}
        error={questionErrors?.type?.message}
        {...register(`questions.${index}.type`, { onChange: onOptionsChange })}
      />
      <fieldset
        className={styles.group}
        aria-describedby={optionsError ? optionsErrorId : undefined}
        aria-invalid={Boolean(optionsError)}
      >
        <legend>Варианты ответа</legend>
        {options.fields.map((field, optionIndex) => (
          <div className={styles.optionRow} key={field.id}>
            <Input
              label={`Вариант ${optionIndex + 1}`}
              isRequired
              error={questionErrors?.options?.[optionIndex]?.text?.message}
              {...register(`questions.${index}.options.${optionIndex}.text`)}
            />
            <Checkbox
              label={`Вариант ${optionIndex + 1} правильный`}
              error={questionErrors?.options?.[optionIndex]?.isCorrect?.message}
              {...register(
                `questions.${index}.options.${optionIndex}.isCorrect`,
                {
                  onChange: onOptionsChange,
                },
              )}
            />
            <Button
              variant="danger"
              disabled={options.fields.length <= QUESTION_OPTIONS_MIN_COUNT}
              aria-label={`Удалить вариант ${optionIndex + 1} вопроса ${index + 1}`}
              onClick={() => {
                options.remove(optionIndex);
                onOptionsChange();
              }}
            >
              Удалить вариант
            </Button>
          </div>
        ))}
        {optionsError && (
          <p className={styles.error} id={optionsErrorId} role="alert">
            {optionsError}
          </p>
        )}
        <Button
          variant="secondary"
          disabled={options.fields.length >= QUESTION_OPTIONS_MAX_COUNT}
          onClick={() => options.append({ text: "", isCorrect: false })}
        >
          Добавить вариант
        </Button>
      </fieldset>
      <div className={styles.actions}>
        <Button
          variant="secondary"
          disabled={!canMoveUp}
          onClick={onMoveUp}
          aria-label={`Переместить вопрос ${index + 1} вверх`}
        >
          Вверх
        </Button>
        <Button
          variant="secondary"
          disabled={!canMoveDown}
          onClick={onMoveDown}
          aria-label={`Переместить вопрос ${index + 1} вниз`}
        >
          Вниз
        </Button>
        <Button variant="danger" disabled={!canRemove} onClick={onRemove}>
          Удалить вопрос
        </Button>
      </div>
    </fieldset>
  );
}
