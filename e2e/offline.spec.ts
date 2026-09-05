import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";

test("a lesson survives a failed offline completion without losing its material", async ({
  page,
  context,
}) => {
  const crashes: string[] = [];
  page.on("pageerror", (error) => crashes.push(error.message));
  await login(page, "student@lms.local");
  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        name: "Правила технической эксплуатации",
        exact: true,
      }),
    })
    .getByRole("link", { name: "Продолжить", exact: true })
    .click();
  const courseUrl = page.url();
  const lessonTitle = "Журнал осмотров: как заполнять";
  await page.getByRole("link", { name: lessonTitle, exact: true }).click();
  const lessonUrl = page.url();
  const material = page.getByText(
    "Записывайте результаты сразу после осмотра. Укажите время, выявленные неисправности и принятые меры.",
    { exact: true },
  );
  const complete = page.getByRole("button", {
    name: "Завершить урок",
    exact: true,
  });
  await expect(material).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "Состояние:" }),
  ).toHaveText("Состояние: В процессе");
  await context.setOffline(true);
  try {
    await complete.click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(material).toBeVisible();
    await expect(page).toHaveURL(lessonUrl);
    await expect(page).not.toHaveURL("/forbidden");
    await context.setOffline(false);
    await page
      .getByRole("link", {
        name: "Вернуться к курсу: Правила технической эксплуатации",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(courseUrl);
    await page.getByRole("link", { name: lessonTitle, exact: true }).click();
    await expect(page).toHaveURL(lessonUrl);
    await expect(material).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(complete).toBeEnabled();
    await expect(
      page.getByRole("status").filter({ hasText: "Состояние:" }),
    ).toHaveText("Состояние: В процессе");
    expect(crashes).toEqual([]);
  } finally {
    await context.setOffline(false);
  }
});

test("learning recovers from a dead network using retry", async ({
  page,
  context,
}) => {
  const crashes: string[] = [];
  page.on("pageerror", (error) => crashes.push(error.message));
  await login(page, "student@lms.local");
  const cards = page.getByRole("article");
  await expect(cards).toHaveCount(3);
  const navigation = page.getByRole("navigation", {
    name: "Основная навигация",
  });
  // Warm the profile route before going offline so this tests data recovery.
  await navigation
    .getByRole("link", { name: "Личный кабинет", exact: true })
    .click();
  await expect(page).toHaveURL("/profile");
  await navigation
    .getByRole("link", { name: "Мое обучение", exact: true })
    .click();
  await expect(cards).toHaveCount(3);
  await context.setOffline(true);
  try {
    await navigation
      .getByRole("link", { name: "Личный кабинет", exact: true })
      .click();
    await expect(page).toHaveURL("/profile");
    await navigation
      .getByRole("link", { name: "Мое обучение", exact: true })
      .click();
    await expect(page).toHaveURL("/learning");
    const error = page.getByRole("alert");
    await expect(
      error.getByRole("heading", { name: "Не удалось загрузить данные" }),
    ).toBeVisible();
    await expect(
      error.getByRole("button", { name: "Повторить" }),
    ).toBeVisible();
    await expect(cards).toHaveCount(0);
    await context.setOffline(false);
    await error.getByRole("button", { name: "Повторить" }).click();
    await expect(cards).toHaveCount(3);
    await expect(
      page.getByRole("heading", {
        name: "Вводный инструктаж по охране труда",
        exact: true,
      }),
    ).toBeVisible();
    await expect(error).toHaveCount(0);
    expect(crashes).toEqual([]);
  } finally {
    await context.setOffline(false);
  }
});
