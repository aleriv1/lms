import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./Button";

describe("Button", () => {
  it("renders, handles clicks, and disables itself while loading", () => {
    const handleClick = vi.fn();
    const { rerender } = render(
      <Button onClick={handleClick}>Сохранить</Button>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(handleClick).toHaveBeenCalledOnce();
    rerender(<Button isLoading>Сохранить</Button>);

    expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled();
  });
});
