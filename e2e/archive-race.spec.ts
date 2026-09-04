import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { login } from "./helpers/auth";

const technicalCourse = "Правила технической эксплуатации";
const introCourse = "Вводный инструктаж по охране труда";
const technicalLesson = "Журнал осмотров: как заполнять";
const archivedMessage = "Курс архивирован: новые действия по нему недоступны";

test.describe("courses archived under an active learner", () => {
  test.describe.configure({ mode: "serial" });
  let adminContext: BrowserContext;
  let admin: Page;

  test.beforeAll(async ({ browser }) => {
    adminContext = await browser.newContext();
    admin = await adminContext.newPage();
    await login(admin, "admin@lms.local");
  });

  test.beforeEach(async ({ page }) => {
    await login(page, "student@lms.local");
  });

  function courseRow(title: string) {
    return admin.getByRole("row").filter({
      has: admin.getByRole("cell", { name: title, exact: true }),
    });
  }

  async function archive(title: string) {
    await admin.goto("/manage/courses");
    const row = courseRow(title);
    await expect(
      row.getByRole("cell", { name: "Опубликован", exact: true }),
    ).toBeVisible();
    await row
      .getByRole("button", { name: "Архивировать", exact: true })
      .click();
    const confirmation = admin.getByRole("dialog", {
      name: "Архивировать курс",
      exact: true,
    });
    await expect(confirmation).toContainText(title);
    await confirmation
      .getByRole("button", { name: "Архивировать", exact: true })
      .click();
    await expect(confirmation).toHaveCount(0);
    await expect(
      row.getByRole("cell", { name: "В архиве", exact: true }),
    ).toBeVisible();
  }

  test.afterAll(async () => {
    try {
      // Try both restorations even if one fails, and report every failure.
      const failures: unknown[] = [];
      for (const title of [technicalCourse, introCourse]) {
        try {
          await admin.goto("/manage/courses");
          const row = courseRow(title);
          await expect(row).toBeVisible();
          if (
            await row
              .getByRole("button", { name: "Опубликовать", exact: true })
              .isVisible()
          ) {
            await row
              .getByRole("button", { name: "Опубликовать", exact: true })
              .click();
          }
          await expect(
            row.getByRole("cell", { name: "Опубликован", exact: true }),
          ).toBeVisible();
        } catch (error) {
          failures.push(error);
        }
      }
      if (failures.length > 0)
        throw new AggregateError(
          failures,
          "Не удалось восстановить публикацию курсов",
        );
      await admin.reload();
      for (const title of [technicalCourse, introCourse]) {
        await expect(
          courseRow(title).getByRole("cell", {
            name: "Опубликован",
            exact: true,
          }),
        ).toBeVisible();
      }
    } finally {
      await adminContext?.close();
    }
  });

  test("an archived lesson refuses a stale completion and remains readable", async ({
    page,
  }) => {
    await page
      .getByRole("article")
      .filter({
        has: page.getByRole("heading", { name: technicalCourse, exact: true }),
      })
      .getByRole("link", { name: "Продолжить", exact: true })
      .click();
    await page
      .getByRole("link", { name: technicalLesson, exact: true })
      .click();
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
    await expect(complete).toBeEnabled();
    await archive(technicalCourse);
    await complete.click();
    await expect(page.getByRole("alert")).toContainText(archivedMessage);
    await expect(page).toHaveURL(lessonUrl);
    await expect(page).not.toHaveURL("/forbidden");
    await expect(material).toBeVisible();
    await page.reload();
    await expect(material).toBeVisible();
    await expect(
      page.getByText("Курс в архиве: доступен только для просмотра", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(complete).toHaveCount(0);
    await expect(
      page.getByRole("status").filter({ hasText: "Состояние:" }),
    ).toHaveText("Состояние: В процессе");
  });

  test("an archived test refuses a stale answer without creating an attempt", async ({
    page,
  }) => {
    await page
      .getByRole("article")
      .filter({
        has: page.getByRole("heading", { name: introCourse, exact: true }),
      })
      .getByRole("link", { name: "Продолжить", exact: true })
      .click();
    await page
      .getByRole("link", {
        name: "Действия при обнаружении опасности",
        exact: true,
      })
      .click();
    const attemptsBefore = await page.getByText(/^Попыток: \d+$/).innerText();
    await page
      .getByRole("link", { name: "Пройти тест ещё раз", exact: true })
      .click();
    const testUrl = page.url();
    await page
      .getByRole("radio", {
        name: "Прекратить работу и сообщить руководителю",
        exact: true,
      })
      .check();
    await archive(introCourse);
    await page
      .getByRole("button", { name: "Отправить ответы", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(archivedMessage);
    await expect(page).toHaveURL(testUrl);
    await expect(
      page.getByRole("region", { name: "Результат попытки" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Разбор ответов", exact: true }),
    ).toHaveCount(0);
    page.once("dialog", (dialog) => dialog.accept());
    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: "Курс в архиве: новые попытки недоступны",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("form", { name: "Ответы на тест", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Отправить ответы", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("link", { name: "Вернуться к уроку", exact: true })
      .click();
    await expect(page.getByText(/^Попыток: \d+$/)).toHaveText(attemptsBefore);
    await expect(
      page.getByRole("link", { name: "Пройти тест ещё раз", exact: true }),
    ).toHaveCount(0);
  });
});
