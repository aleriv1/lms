import { expect, test, type Page } from "@playwright/test";

import { login } from "./helpers/auth";

const originalName = "Администратор Системы";
const changedName = `${originalName} — изменено`;
const unsavedPassword = "UnsavedPassword1";

async function openProfile(page: Page) {
  await login(page, "admin@lms.local");
  await page.goto("/profile/edit");
  await expect(
    page.getByRole("textbox", { name: "Имя *", exact: true }),
  ).toHaveValue(originalName);
}

async function discardByReloading(page: Page) {
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Имя *", exact: true }),
  ).toHaveValue(originalName);
  await expect(page.getByLabel("Новый пароль *", { exact: true })).toHaveValue(
    "",
  );
}

test("a real beforeunload on the profile keeps the typed name on dismissal", async ({
  page,
}) => {
  await openProfile(page);
  const name = page.getByRole("textbox", { name: "Имя *", exact: true });
  await name.press("End");
  await name.pressSequentially(" — изменено");
  const browserDialog = page.waitForEvent("dialog");
  const reload = page.evaluate(() => window.location.reload());
  const dialog = await browserDialog;
  expect(dialog.type()).toBe("beforeunload");
  await dialog.dismiss();
  await reload;
  await expect(page).toHaveURL("/profile/edit");
  await expect(name).toHaveValue(changedName);
});

test("one profile dialog protects either dirty block and both blocks together", async ({
  page,
}) => {
  await openProfile(page);
  const name = page.getByRole("textbox", { name: "Имя *", exact: true });
  const password = page.getByLabel("Новый пароль *", { exact: true });
  const dialog = page.getByRole("dialog", { name: "Покинуть страницу?" });

  for (const dirtyBlock of ["name", "password", "both"]) {
    if (dirtyBlock !== "password") await name.fill(changedName);
    if (dirtyBlock !== "name") await password.fill(unsavedPassword);
    await page.getByRole("link", { name: "Назад в личный кабинет" }).click();
    await expect(dialog).toHaveCount(1);
    await dialog.getByRole("button", { name: "Остаться" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL("/profile/edit");
    await expect(name).toHaveValue(
      dirtyBlock === "password" ? originalName : changedName,
    );
    await expect(password).toHaveValue(
      dirtyBlock === "name" ? "" : unsavedPassword,
    );
    await discardByReloading(page);
  }
});

test("closing a dirty profile tab asks and only closes after accepting", async ({
  browser,
}) => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openProfile(page);
    const name = page.getByRole("textbox", { name: "Имя *", exact: true });
    await name.press("End");
    await name.pressSequentially(" — изменено");
    const firstDialog = page.waitForEvent("dialog");
    await page.close({ runBeforeUnload: true });
    const dismissed = await firstDialog;
    expect(dismissed.type()).toBe("beforeunload");
    await dismissed.dismiss();
    expect(page.isClosed()).toBe(false);
    await expect(page).toHaveURL("/profile/edit");
    await expect(name).toHaveValue(changedName);

    const secondDialog = page.waitForEvent("dialog");
    const closed = page.waitForEvent("close");
    await page.close({ runBeforeUnload: true });
    const accepted = await secondDialog;
    expect(accepted.type()).toBe("beforeunload");
    await accepted.accept();
    await closed;
    expect(page.isClosed()).toBe(true);
  } finally {
    await context.close();
  }
});
