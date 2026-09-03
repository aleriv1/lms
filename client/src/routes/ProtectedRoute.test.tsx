import { publicUserSchema, type UserRole } from "@lms/shared";
import { configureStore } from "@reduxjs/toolkit";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { authReducer, type AuthState } from "../features/auth/authSlice";
import { ProtectedRoute } from "./ProtectedRoute";

function makeUser(role: UserRole) {
  return publicUserSchema.parse({
    id: "aaaaaaaaaaaaaaaaaaaaaaaa",
    name: "Пользователь",
    email: "user@lms.local",
    role,
    groupName: null,
    status: "active",
    lastLoginAt: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  });
}

function renderAdminRoute({ user, status }: AuthState) {
  const store = configureStore({
    reducer: { auth: authReducer },
    preloadedState: { auth: { user, status } },
  });

  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<ProtectedRoute roles={["admin"]} />}>
            <Route index element={<h1>Защищенное содержимое</h1>} />
          </Route>
          <Route path="/login" element={<h1>Вход</h1>} />
          <Route path="/forbidden" element={<h1>Нет доступа</h1>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

describe("ProtectedRoute", () => {
  it("redirects an anonymous user to login", () => {
    renderAdminRoute({ user: null, status: "anonymous" });
    expect(screen.getByRole("heading", { name: "Вход" })).toBeInTheDocument();
  });

  it("redirects a student to the forbidden screen", () => {
    renderAdminRoute({ user: makeUser("student"), status: "authenticated" });
    expect(
      screen.getByRole("heading", { name: "Нет доступа" }),
    ).toBeInTheDocument();
  });

  it("shows protected content to an admin", () => {
    renderAdminRoute({ user: makeUser("admin"), status: "authenticated" });
    expect(
      screen.getByRole("heading", { name: "Защищенное содержимое" }),
    ).toBeInTheDocument();
  });
});
