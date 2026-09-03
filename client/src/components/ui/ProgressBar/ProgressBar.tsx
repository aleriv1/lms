import { useId } from "react";

import styles from "./ProgressBar.module.css";

export type ProgressBarProps = { value: number; label?: string };

export function ProgressBar({ value, label = "Прогресс" }: ProgressBarProps) {
  const id = useId();

  return (
    <div className={styles.container}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <div className={styles.track}>
        <progress id={id} className={styles.progress} max={100} value={value} />
        <span className={styles.value}>{value} %</span>
      </div>
    </div>
  );
}
