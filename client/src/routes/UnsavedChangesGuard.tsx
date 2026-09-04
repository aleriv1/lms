import { useEffect, type ReactNode } from "react";
import { useBlocker } from "react-router-dom";

import { Button, Modal } from "../components/ui";

export type UnsavedChangesGuardProps = { when: boolean };

export function UnsavedChangesGuard({
  when,
}: UnsavedChangesGuardProps): ReactNode {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      when &&
      currentLocation.pathname !== nextLocation.pathname &&
      nextLocation.pathname !== "/login",
  );

  useEffect(() => {
    if (blocker.state === "blocked" && !when) {
      blocker.reset();
    }
  }, [blocker, when]);

  useEffect(() => {
    if (!when) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [when]);

  return (
    <Modal
      isOpen={blocker.state === "blocked"}
      title="Покинуть страницу?"
      onClose={() => blocker.reset?.()}
      footer={
        <>
          <Button variant="secondary" onClick={() => blocker.reset?.()}>
            Остаться
          </Button>
          <Button onClick={() => blocker.proceed?.()}>
            Уйти без сохранения
          </Button>
        </>
      }
    >
      <p>Введённые данные не сохранены. Если уйти сейчас, они будут потеряны.</p>
    </Modal>
  );
}
