import type { ButtonHTMLAttributes } from "react";

import styles from "./Button.module.css";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  isLoading?: boolean;
};

export function Button({
  variant = "primary",
  isLoading = false,
  type = "button",
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
  const classes = [styles.button, styles[variant], className]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...props}
      className={classes}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      type={type}
    >
      {isLoading && <span className={styles.spinner} aria-hidden="true" />}
      {children}
    </button>
  );
}
