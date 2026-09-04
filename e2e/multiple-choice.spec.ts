import { expect, test, type Page } from "@playwright/test";

import { login } from "./helpers/auth";

const helmet = "Защитная каска";
const glasses = "Защитные очки";
const car = "Служебный автомобиль";

test.describe("review of multiple-choice attempts", () => {
  test.describe.configure({ mode: "serial" });
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page, "student@lms.local");
    await page
      .getByRole("article")
      .filter({
        has: page.getByRole("heading", {
          name: "Вводный инструктаж по охране труда",
          exact: true,
        }),
      })
      .getByRole("link", { name: "Продолжить", exact: true })
      .click();
    await page
      .getByRole("link", {
        name: "Проверка готовности к безопасной работе",
        exact: true,
      })
      .click();
    await expect(page.getByText("Попыток: 1", { exact: true })).toBeVisible();
    await page
      .getByRole("link", { name: "Пройти тест ещё раз", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Проверка средств индивидуальной защиты",
        exact: true,
      }),
    ).toBeVisible();
  });

  test.afterAll(async () => {
    await page?.close();
  });

  function option(text: string) {
    return page
      .getByRole("region", { name: "Результат попытки" })
      .getByRole("listitem")
      .filter({ has: page.getByText(text, { exact: true }) })
      .filter({ hasNot: page.getByRole("list") });
  }

  test("a partially correct answer is wrong and labels each option separately", async () => {
    await page.getByRole("checkbox", { name: helmet, exact: true }).check();
    await page
      .getByRole("button", { name: "Отправить ответы", exact: true })
      .click();
    await expect(page.getByText("Попытка №2", { exact: true })).toBeVisible();
    await expect(page.getByText("Неверно", { exact: true })).toBeVisible();
    await expect(option(helmet)).toContainText("ваш выбор");
    await expect(option(helmet)).toContainText("правильный ответ");
    await expect(option(glasses)).toContainText("правильный ответ");
    await expect(option(glasses)).not.toContainText("ваш выбор");
    await expect(option(car)).not.toContainText("правильный ответ");
    await expect(option(car)).not.toContainText("ваш выбор");
  });

  test("both correct options pass and carry both labels", async () => {
    await page.getByRole("button", { name: "Пройти ещё раз" }).click();
    await page.getByRole("checkbox", { name: helmet, exact: true }).check();
    await page.getByRole("checkbox", { name: glasses, exact: true }).check();
    await page
      .getByRole("button", { name: "Отправить ответы", exact: true })
      .click();
    await expect(page.getByText("Попытка №3", { exact: true })).toBeVisible();
    await expect(page.getByText("Верно", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Тест пройден", exact: true }),
    ).toBeVisible();
    for (const answer of [helmet, glasses]) {
      await expect(option(answer)).toContainText("ваш выбор");
      await expect(option(answer)).toContainText("правильный ответ");
    }
  });
});
