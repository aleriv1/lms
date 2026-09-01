import { useId } from "react";
import type { SelectHTMLAttributes } from "react";

import styles from "./Select.module.css";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  isRequired?: boolean;
  options: { value: string; label: string }[];
};

export function Select({
  label,
  error,
  isRequired = false,
  options,
  id,
  required,
  className,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = `${selectId}-error`;
  const classes = [styles.select, error && styles.invalid, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={selectId}>
        {label}
        {isRequired && <span className={styles.required}> *</span>}
      </label>
      <select
        {...props}
        id={selectId}
        className={classes}
        required={required || isRequired}
        aria-required={isRequired || undefined}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : props["aria-describedby"]}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <span className={styles.error} id={errorId}>
          {error}
        </span>
      )}
    </div>
  );
}
