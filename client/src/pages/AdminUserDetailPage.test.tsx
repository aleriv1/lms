import { transferableAbortController } from "node:util";

import { adminUserDetailSchema, courseListItemSchema, publicUserSchema } from "@lms/shared";
import { configureStore } from "@reduxjs/toolkit";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { authReducer } from "../features/auth/authSlice";
import { requestCourses } from "../features/courses/coursesApi";
import { adminUsersReducer } from "../features/users/adminUsersSlice";
import { requestAdminUser } from "../features/users/usersApi";
import { AdminUserDetailPage } from "./AdminUserDetailPage";

vi.mock("../features/courses/coursesApi", () => ({ requestCourses: vi.fn() }));
vi.mock("../features/users/usersApi", () => ({ requestAdminUser: vi.fn() }));

// Node's Request requires a native signal rather than jsdom's AbortSignal.
beforeAll(() => {
  vi.stubGlobal("AbortController", class {
    constructor() {
      return transferableAbortController();
    }
  });
});
afterAll(() => vi.unstubAllGlobals());

const user = adminUserDetailSchema.parse({
  id: "aaaaaaaaaaaaaaaaaaaaaaaa",
  name: "Ученик",
  email: "student@lms.local",
  role: "student",
  groupName: null,
  status: "active",
  lastLoginAt: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  assignments: [],
});
const admin = publicUserSchema.parse({
  ...user,
  id: "bbbbbbbbbbbbbbbbbbbbbbbb",
  name: "Администратор",
  email: "admin@lms.local",
  role: "admin",
});
const course = courseListItemSchema.parse({
  id: "cccccccccccccccccccccccc",
  title: "Безопасность движения",
  category: "Безопасность",
  audience: "drivers",
  shortDescription: "Основные правила безопасности движения",
  coverUrl: null,
  author: { id: admin.id, name: admin.name },
  status: "published",
  publishedAt: "2026-09-01T00:00:00.000Z",
  lessonsCount: 1,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
});

async function renderDetail() {
  const store = configureStore({
    reducer: { auth: authReducer, adminUsers: adminUsersReducer },
    preloadedState: {
      auth: { user: admin, status: "authenticated" as const },
      adminUsers: {
        ...adminUsersReducer(undefined, { type: "init" }),
        detail: { user, status: "ready" as const, error: null },
      },
    },
  });
  const router = createMemoryRouter(
    [
      { path: "/admin/users/:userId", element: <AdminUserDetailPage /> },
      { path: "/admin/users", element: <h1>Пользователи</h1> },
    ],
    { initialEntries: [`/admin/users/${user.id}`] },
  );
  render(<Provider store={store}><RouterProvider router={router} /></Provider>);
  await screen.findByRole("combobox", { name: /Опубликованный курс/ });
}

function goBack() {
  fireEvent.click(screen.getByRole("link", { name: "Назад к пользователям" }));
}

describe("AdminUserDetailPage", () => {
  beforeEach(() => {
    vi.mocked(requestAdminUser).mockResolvedValue(user);
    vi.mocked(requestCourses).mockResolvedValue({
      items: [course],
      meta: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
    });
  });

  it("asks before leaving when only the user name has changed", async () => {
    await renderDetail();
    await act(async () => {
      fireEvent.change(screen.getByRole("textbox", { name: /Имя/ }), {
        target: { value: "Новое имя" },
      });
    });
    goBack();
    expect(await screen.findByRole("dialog", { name: "Покинуть страницу?" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Пользователи" })).not.toBeInTheDocument();
  });

  // Separate per-form guards would fail this case by letting the other form's flag decide.
  it("asks before leaving when only the assigned course has changed", async () => {
    await renderDetail();
    await act(async () => {
      fireEvent.change(screen.getByRole("combobox", { name: /Опубликованный курс/ }), {
        target: { value: course.id },
      });
    });
    expect(screen.getByRole("textbox", { name: /Имя/ })).toHaveValue(user.name);
    goBack();
    expect(await screen.findByRole("dialog", { name: "Покинуть страницу?" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Пользователи" })).not.toBeInTheDocument();
  });

  it("returns to the user list without asking when neither form changed", async () => {
    await renderDetail();
    goBack();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Пользователи" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
