import styles from "./Loader.module.css";

export type LoaderProps = { label?: string };

export function Loader({ label = "Загрузка" }: LoaderProps) {
  return (
    <div className={styles.loader} role="status">
      <span className={styles.spinner} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
