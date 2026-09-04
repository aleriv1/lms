import { expect, type Page } from "@playwright/test";

export async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email *", exact: true }).fill(email);
  await page.getByLabel("Пароль *", { exact: true }).fill("Password1");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(
    email === "admin@lms.local" ? "/admin" : "/learning",
  );
  await expect(
    page.getByRole("navigation", { name: "Основная навигация" }),
  ).toBeVisible();
}
