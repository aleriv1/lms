import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Modal } from "./Modal";

describe("Modal", () => {
  it("renders by open state and closes on Escape", () => {
    const handleClose = vi.fn();
    const { rerender } = render(
      <Modal isOpen={false} title="Подтверждение" onClose={vi.fn()}>
        Содержимое
      </Modal>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    rerender(
      <Modal isOpen title="Подтверждение" onClose={handleClose}>
        Содержимое
      </Modal>,
    );

    expect(screen.getByRole("dialog")).toHaveAccessibleName("Подтверждение");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(handleClose).toHaveBeenCalledOnce();
  });
});
