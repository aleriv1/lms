import { useId } from "react";
import type { InputHTMLAttributes } from "react";

import styles from "./Checkbox.module.css";

export type CheckboxProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  isRequired?: boolean;
};

export function Checkbox({
  label,
  error,
  isRequired = false,
  id,
  required,
  className,
  ...props
}: CheckboxProps) {
  const generatedId = useId();
  const checkboxId = id ?? generatedId;
  const errorId = `${checkboxId}-error`;
  const classes = [styles.checkbox, className].filter(Boolean).join(" ");

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={checkboxId}>
        <input
          {...props}
          id={checkboxId}
          className={classes}
          required={required || isRequired}
          aria-required={isRequired || undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : props["aria-describedby"]}
          type="checkbox"
        />
        <span>
          {label}
          {isRequired && <span className={styles.required}> *</span>}
        </span>
      </label>
      {error && (
        <span className={styles.error} id={errorId}>
          {error}
        </span>
      )}
    </div>
  );
}
