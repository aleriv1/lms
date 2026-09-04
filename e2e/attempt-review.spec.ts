import { expect, test, type Page } from "@playwright/test";

import { login } from "./helpers/auth";

const wrongAnswer = "Продолжить работу до конца смены";
const correctAnswer = "Прекратить работу и сообщить руководителю";

test.describe("review across consecutive attempts", () => {
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
        name: "Действия при обнаружении опасности",
        exact: true,
      })
      .click();
    await page
      .getByRole("link", { name: "Пройти тест ещё раз", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Проверка знаний по вводному инструктажу",
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

  test("a wrong answer is labelled on both sides", async () => {
    await page.getByRole("radio", { name: wrongAnswer, exact: true }).check();
    await page
      .getByRole("link", { name: "Вернуться к курсу", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Покинуть страницу?" })
      .getByRole("button", { name: "Остаться" })
      .click();
    await page
      .getByRole("button", { name: "Отправить ответы", exact: true })
      .click();
    await expect(page.getByText("Попытка №4", { exact: true })).toBeVisible();
    await expect(page.getByText("Неверно", { exact: true })).toBeVisible();
    await expect(option(wrongAnswer)).toContainText("ваш выбор");
    await expect(option(wrongAnswer)).not.toContainText("правильный ответ");
    await expect(option(correctAnswer)).toContainText("правильный ответ");
    await expect(option(correctAnswer)).not.toContainText("ваш выбор");
  });

  test("a correct answer carries both labels", async () => {
    await page.getByRole("button", { name: "Пройти ещё раз" }).click();
    await page.getByRole("radio", { name: correctAnswer, exact: true }).check();
    await page
      .getByRole("button", { name: "Отправить ответы", exact: true })
      .click();
    await expect(page.getByText("Попытка №5", { exact: true })).toBeVisible();
    await expect(page.getByText("Верно", { exact: true })).toBeVisible();
    await expect(option(correctAnswer)).toContainText("правильный ответ");
    await expect(option(correctAnswer)).toContainText("ваш выбор");
  });

  test("an empty submission says so and still marks the correct answer", async () => {
    await page.getByRole("button", { name: "Пройти ещё раз" }).click();
    await expect(
      page.getByRole("radio", { name: correctAnswer, exact: true }),
    ).not.toBeChecked();
    await expect(
      page.getByRole("radio", { name: wrongAnswer, exact: true }),
    ).not.toBeChecked();
    await page
      .getByRole("button", { name: "Отправить ответы", exact: true })
      .click();
    const confirmation = page.getByRole("dialog", {
      name: "Отправить ответы?",
    });
    await expect(confirmation).toContainText("Вопросов без ответа: 1");
    await confirmation
      .getByRole("button", { name: "Подтвердить отправку" })
      .click();
    await expect(page.getByText("Попытка №6", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Вы не ответили", { exact: true }),
    ).toBeVisible();
    await expect(option(correctAnswer)).toContainText("правильный ответ");
    await expect(
      page.getByRole("region", { name: "Результат попытки" }),
    ).not.toContainText("ваш выбор");
  });
});
