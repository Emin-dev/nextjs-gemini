import { test, expect } from "./local-fixture";

test("unknown routes return 404", {
  annotation: { type: "expected-document-404", description: "/ci-smoke-missing-route" },
}, async ({ page }, testInfo) => {
  const response = await page.goto("/ci-smoke-missing-route");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "404", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "This page could not be found.", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("not-found.png"), fullPage: true, animations: "disabled" });
});

test("todo create, persistence, completion, editing, search and undo", async ({ page }, testInfo) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  const original = "CI synthetic task";
  const edited = `${original} edited`;
  const addInput = page.getByRole("textbox", { name: "New task text" });
  await expect(addInput).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("homepage.png"), fullPage: true, animations: "disabled" });
  await expect(page.getByRole("button", { name: "Add Task", exact: true })).toBeDisabled();
  await addInput.fill(original);
  await page.getByRole("button", { name: "Add Task", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: `Mark task "${original}" as complete`, exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("checkbox", { name: `Mark task "${original}" as complete`, exact: true }).click();
  await page.locator('label[for="filter-completed"]').click();
  await expect(page.getByRole("checkbox", { name: `Mark task "${original}" as incomplete`, exact: true })).toBeVisible();
  await page.locator('label[for="filter-all"]').click();
  await page.getByRole("button", { name: `Edit task: ${original}`, exact: true }).click();
  let editInput = page.getByRole("textbox", { name: `Edit text for task: ${original}`, exact: true });
  await editInput.fill("Cancelled edit");
  await editInput.press("Escape");
  await expect(page.getByRole("checkbox", { name: `Mark task "${original}" as incomplete`, exact: true })).toBeVisible();
  await page.getByRole("button", { name: `Edit task: ${original}`, exact: true }).click();
  editInput = page.getByRole("textbox", { name: `Edit text for task: ${original}`, exact: true });
  await editInput.fill(edited);
  await editInput.press("Enter");
  await expect(page.getByRole("checkbox", { name: `Mark task "${edited}" as incomplete`, exact: true })).toBeVisible();
  const search = page.getByRole("searchbox", { name: "Search tasks by keyword" });
  await search.fill("no-matching-ci-task");
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await search.clear();
  await page.getByRole("button", { name: `Delete task: ${edited}`, exact: true }).click();
  await page.getByRole("button", { name: /^Undo delete for task:/ }).click();
  await expect(page.getByRole("checkbox", { name: `Mark task "${edited}" as incomplete`, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: `Mark task "${edited}" as incomplete`, exact: true })).toBeVisible();
});
