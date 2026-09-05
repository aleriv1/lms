import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";

test("the burger opens navigation and the sidebar toggle is remembered", async ({
  page,
}) => {
  await login(page, "admin@lms.local");
  const nav = page.getByRole("navigation", { name: "Основная навигация" });

  await page.setViewportSize({ width: 375, height: 800 });
  await expect(nav).toBeHidden();
  await page.getByRole("button", { name: "Показать меню" }).click();
  await expect(nav).toBeVisible();
  await page.getByRole("link", { name: "Каталог курсов" }).click();
  await expect(nav).toBeHidden();

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(nav).toBeVisible();
  await page.getByRole("button", { name: "Скрыть меню" }).click();
  await expect(nav).toBeHidden();
  await page.reload();
  await expect(nav).toBeHidden();
  await page.getByRole("button", { name: "Показать меню" }).click();
  await expect(nav).toBeVisible();
});
