import { transferableAbortController } from "node:util";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { createMemoryRouter, Link, RouterProvider } from "react-router-dom";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { UnsavedChangesGuard } from "./UnsavedChangesGuard";

// A real router navigation builds a Request, and Node's Request rejects jsdom's
// AbortSignal. Without this the whole file fails on the first navigation.
beforeAll(() => {
  vi.stubGlobal("AbortController", class {
    constructor() {
      return transferableAbortController();
    }
  });
});
afterAll(() => vi.unstubAllGlobals());

function Harness({ when }: { when: boolean }) {
  const [isDirty, setIsDirty] = useState(when);
  return (
    <>
      <UnsavedChangesGuard when={isDirty} />
      <h1>Форма</h1>
      <Link to="/elsewhere">Другая страница</Link>
      <Link to="/form?page=2">Вторая страница</Link>
      <Link to="/login">Вход</Link>
      <button onClick={() => setIsDirty(false)}>Сбросить изменения</button>
    </>
  );
}

function renderForm(when = true) {
  const router = createMemoryRouter(
    [
      { path: "/form", element: <Harness when={when} /> },
      { path: "/elsewhere", element: <h1>Другая страница</h1> },
      { path: "/login", element: <h1>Вход</h1> },
    ],
    { initialEntries: ["/form"] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

function leaveForm() {
  fireEvent.click(screen.getByRole("link", { name: "Другая страница" }));
}

describe("UnsavedChangesGuard", () => {
  it("asks before leaving a dirty form and keeps the destination hidden", () => {
    renderForm();
    leaveForm();
    expect(screen.getByRole("dialog", { name: "Покинуть страницу?" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Другая страница" })).not.toBeInTheDocument();
  });

  it("stays on the form when the user chooses to stay", () => {
    const router = renderForm();
    leaveForm();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Остаться" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Форма" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/form");
  });

  it("leaves without saving when the user confirms", async () => {
    renderForm();
    leaveForm();
    fireEvent.click(screen.getByRole("button", { name: "Уйти без сохранения" }));
    expect(await screen.findByRole("heading", { name: "Другая страница" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("leaves a clean form without asking", async () => {
    renderForm(false);
    leaveForm();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Другая страница" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("changes search parameters on a dirty form without asking", async () => {
    const router = renderForm();
    fireEvent.click(screen.getByRole("link", { name: "Вторая страница" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(router.state.location.search).toBe("?page=2"));
    expect(router.state.location.pathname).toBe("/form");
    expect(screen.getByRole("heading", { name: "Форма" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("allows navigation to login from a dirty form without asking", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("link", { name: "Вход" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Вход" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // The form saved from under an open dialog must not leave the dialog stuck.
  // The guard calls blocker.reset(): the blocker returns to "unblocked" and the
  // user stays where they were, so the click that opened the dialog is dropped
  // rather than replayed. The next click then leaves without asking.
  it("dismisses the open dialog and stays put when the form becomes clean", async () => {
    const router = renderForm();
    leaveForm();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Сбросить изменения" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(router.state.location.pathname).toBe("/form");
    expect(screen.getByRole("heading", { name: "Форма" })).toBeInTheDocument();

    leaveForm();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Другая страница" })).toBeInTheDocument();
  });

  it("prevents beforeunload only while the form is dirty", () => {
    renderForm();
    const dirtyEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirtyEvent);
    expect(dirtyEvent.defaultPrevented).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Сбросить изменения" }));
    const cleanEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);
  });
});
