import { expect, test, type Dialog, type Page } from "@playwright/test";

import { login } from "./helpers/auth";

const courseTitle = "Вводный инструктаж по охране труда";
const learnerName = "Обучающийся Петров";

function guard(page: Page) {
  return page.getByRole("dialog", { name: "Покинуть страницу?" });
}

async function openCourse(page: Page, title = courseTitle) {
  await page.goto("/manage/courses");
  await page
    .getByRole("row")
    .filter({ hasText: title })
    .getByRole("link", { name: "Редактировать", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Название *", exact: true }),
  ).toHaveValue(title);
}

async function reloadDiscardingChanges(page: Page) {
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Имя *", exact: true }),
  ).toHaveValue(learnerName);
}

test.beforeEach(async ({ page }) => {
  await login(page, "admin@lms.local");
});

test("Escape and the close button keep the form", async ({ page }) => {
  await page.goto("/manage/courses/new");
  const title = page.getByRole("textbox", { name: "Название *", exact: true });
  await title.fill("Инструктаж смены");
  const back = page.getByRole("link", { name: "Назад в каталог" });

  for (const action of ["Escape", "Закрыть", "Остаться"]) {
    await back.click();
    await expect(guard(page)).toBeVisible();
    if (action === "Escape") await page.keyboard.press("Escape");
    else
      await guard(page)
        .getByRole("button", { name: action, exact: true })
        .click();
    await expect(guard(page)).toHaveCount(0);
    await expect(page).toHaveURL("/manage/courses/new");
    await expect(title).toHaveValue("Инструктаж смены");
  }

  await back.click();
  await guard(page)
    .getByRole("button", { name: "Уйти без сохранения" })
    .click();
  await expect(page).toHaveURL("/manage/courses");
});

test("a real beforeunload on reload keeps unsaved text and stops after clearing", async ({
  page,
}) => {
  await page.goto("/manage/courses/new");
  const title = page.getByRole("textbox", { name: "Название *", exact: true });
  await title.pressSequentially("Инструктаж смены");
  const browserDialog = page.waitForEvent("dialog");
  // Request a real reload without waiting for a load event that dismissal cancels.
  const reload = page.evaluate(() => window.location.reload());
  const dialog = await browserDialog;
  expect(dialog.type()).toBe("beforeunload");
  await dialog.dismiss();
  await reload;
  await expect(page).toHaveURL("/manage/courses/new");
  await expect(title).toHaveValue("Инструктаж смены");

  await title.fill("");
  const dialogs: string[] = [];
  const recordDialog = async (unexpected: Dialog) => {
    dialogs.push(unexpected.type());
    await unexpected.accept();
  };
  page.on("dialog", recordDialog);
  try {
    await page.reload();
    await expect(title).toHaveValue("");
    expect(dialogs).toEqual([]);
  } finally {
    page.off("dialog", recordDialog);
  }
});

test("a saved lesson stops asking", async ({ page }) => {
  await openCourse(page);
  const courseUrl = page.url();
  await page
    .getByRole("link", { name: "Что такое вводный инструктаж", exact: true })
    .click();
  const lessonUrl = page.url();
  await page
    .getByRole("textbox", { name: "Название *", exact: true })
    .fill("Что такое вводный инструктаж — обновлено");
  await page.getByRole("link", { name: "Назад к курсу" }).click();
  await expect(guard(page)).toBeVisible();
  await guard(page).getByRole("button", { name: "Остаться" }).click();
  await expect(page).toHaveURL(lessonUrl);
  await page.getByRole("button", { name: "Сохранить изменения" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Изменения сохранены" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Назад к курсу" }).click();
  await expect(page).toHaveURL(courseUrl);
  await expect(guard(page)).toHaveCount(0);
  await expect(
    page.getByRole("link", {
      name: "Что такое вводный инструктаж — обновлено",
      exact: true,
    }),
  ).toBeVisible();
});

test("a saved course stops asking", async ({ page }) => {
  const title = "Подготовка к сезонному осмотру";
  await openCourse(page, title);
  await page
    .getByRole("textbox", { name: "Название *", exact: true })
    .fill(`${title} — обновлено`);
  await page.getByRole("link", { name: "Назад в каталог" }).click();
  await expect(guard(page)).toBeVisible();
  await guard(page).getByRole("button", { name: "Остаться" }).click();
  await page.getByRole("button", { name: "Сохранить изменения" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Изменения сохранены" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Назад в каталог" }).click();
  await expect(page).toHaveURL("/manage/courses");
  await expect(guard(page)).toHaveCount(0);
  await expect(
    page.getByRole("row").filter({ hasText: `${title} — обновлено` }),
  ).toBeVisible();
});

test("one guard covers both forms on the user page", async ({ page }) => {
  await page.goto("/admin/users");
  await page
    .getByRole("searchbox", { name: "Поиск по имени или email" })
    .fill("student@lms.local");
  await page
    .getByRole("row")
    .filter({ hasText: "student@lms.local" })
    .getByRole("link", { name: "Открыть карточку" })
    .click();
  const userUrl = page.url();
  const name = page.getByRole("textbox", { name: "Имя *", exact: true });
  const back = page.getByRole("link", { name: "Назад к пользователям" });
  await name.fill(`${learnerName} — изменено`);
  await back.click();
  await expect(guard(page)).toHaveCount(1);
  await guard(page).getByRole("button", { name: "Остаться" }).click();
  await expect(page).toHaveURL(userUrl);
  await reloadDiscardingChanges(page);

  await page
    .getByRole("combobox", { name: "Опубликованный курс" })
    .selectOption({ label: "Работа с диспетчерской системой" });
  await back.click();
  await expect(guard(page)).toHaveCount(1);
  await guard(page).getByRole("button", { name: "Остаться" }).click();
  await expect(page).toHaveURL(userUrl);
  await reloadDiscardingChanges(page);
  await expect(
    page.getByRole("combobox", { name: "Опубликованный курс" }),
  ).toHaveValue("");
  await back.click();
  await expect(page).toHaveURL("/admin/users");
  await expect(guard(page)).toHaveCount(0);
});

test("signing out of a dirty form does not ask or restore the admin session", async ({
  page,
}) => {
  await page.goto("/manage/courses/new");
  await page
    .getByRole("textbox", { name: "Название *", exact: true })
    .fill("Инструктаж смены");
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await expect(page).toHaveURL("/login");
  await expect(guard(page)).toHaveCount(0);
  await login(page, "student@lms.local");
  const sidebar = page.getByRole("complementary");
  await expect(sidebar).toContainText(learnerName);
  await expect(sidebar).not.toContainText("Администратор Системы");
  await expect(
    sidebar.getByRole("link", { name: "Пользователи", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Название *", exact: true }),
  ).toHaveCount(0);
});
