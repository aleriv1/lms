import { useId } from "react";
import type { TextareaHTMLAttributes } from "react";

import styles from "./Textarea.module.css";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
  isRequired?: boolean;
};

export function Textarea({
  label,
  error,
  isRequired = false,
  id,
  required,
  className,
  ...props
}: TextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const errorId = `${textareaId}-error`;
  const classes = [styles.textarea, error && styles.invalid, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={textareaId}>
        {label}
        {isRequired && <span className={styles.required}> *</span>}
      </label>
      <textarea
        {...props}
        id={textareaId}
        className={classes}
        required={required || isRequired}
        aria-required={isRequired || undefined}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : props["aria-describedby"]}
      />
      {error && (
        <span className={styles.error} id={errorId}>
          {error}
        </span>
      )}
    </div>
  );
}
