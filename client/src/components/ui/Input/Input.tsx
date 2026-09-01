import { useId } from "react";
import type { InputHTMLAttributes } from "react";

import styles from "./Input.module.css";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  isRequired?: boolean;
};

export function Input({
  label,
  error,
  isRequired = false,
  id,
  required,
  className,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const classes = [styles.input, error && styles.invalid, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
        {isRequired && <span className={styles.required}> *</span>}
      </label>
      <input
        {...props}
        id={inputId}
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
