import { useId, useState } from "react";
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
  type,
  ...props
}: InputProps) {
  const generatedId = useId();
  const [isRevealed, setIsRevealed] = useState(false);
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const isPassword = type === "password";
  const classes = [
    styles.input,
    error && styles.invalid,
    isPassword && styles.withToggle,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
        {isRequired && <span className={styles.required}> *</span>}
      </label>
      <div className={styles.control}>
        <input
          {...props}
          id={inputId}
          type={isPassword && isRevealed ? "text" : type}
          className={classes}
          required={required || isRequired}
          aria-required={isRequired || undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : props["aria-describedby"]}
        />
        {isPassword && (
          <button
            className={styles.toggle}
            type="button"
            onClick={() => setIsRevealed((value) => !value)}
            aria-label={isRevealed ? "Скрыть пароль" : "Показать пароль"}
            aria-pressed={isRevealed}
            tabIndex={-1}
          >
            {isRevealed ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
      {error && (
        <span className={styles.error} id={errorId}>
          {error}
        </span>
      )}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.9 5.7A10.6 10.6 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a18.5 18.5 0 0 1-3.3 4.2M6.3 7.8A18.4 18.4 0 0 0 2 12s3.6 6.5 10 6.5c1.6 0 3-.4 4.2-1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M3 3l18 18" />
    </svg>
  );
}
