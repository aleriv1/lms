import { Button } from "../Button/Button";
import styles from "./ErrorState.module.css";

export type ErrorStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title = "Не удалось загрузить данные",
  description,
  onRetry,
}: ErrorStateProps) {
  return (
    <section className={styles.state} role="alert">
      <h2 className={styles.title}>{title}</h2>
      {description && <p>{description}</p>}
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Повторить
        </Button>
      )}
    </section>
  );
}
