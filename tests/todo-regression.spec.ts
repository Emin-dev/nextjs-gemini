import type { Page } from "@playwright/test";
import type { Todo, UndoableActionDetails } from "../app/types";
import {
  AUTO_FINAL_DELETE_INTERVAL,
  CURRENT_TIME_UPDATE_INTERVAL,
  FILTER_STORAGE_KEY,
  INACTIVITY_TIMEOUT,
  LOCAL_STORAGE_KEY,
  SEARCH_QUERY_STORAGE_KEY,
  STAGE_2_GRACE_PERIOD_DURATION,
  STAGE_4_GLOBAL_RESTORE_WINDOW,
  UNDOABLE_ACTIONS_STORAGE_KEY,
  UNDO_TIMEOUT,
} from "../app/lib/constants";
import { test, expect } from "./local-fixture";

const newTaskInput = (page: Page) => page.getByRole("textbox", { name: "New task text" });
const taskCheckbox = (page: Page, text: string, completed = false) => page.getByRole("checkbox", {
  name: `Mark task "${text}" as ${completed ? "incomplete" : "complete"}`,
  exact: true,
});
const undoButton = (page: Page, text: string) => page.getByRole("button", {
  name: new RegExp(`^Undo delete for task: ${text} \\(`),
});

async function createTask(page: Page, text: string) {
  await newTaskInput(page).fill(text);
  await newTaskInput(page).press("Enter");
  await expect(taskCheckbox(page, text)).toBeVisible();
  await expect(newTaskInput(page)).toHaveValue("");
}

async function readTodos(page: Page): Promise<Todo[]> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "[]"), LOCAL_STORAGE_KEY);
}

async function readUndoableActions(page: Page): Promise<Record<string, UndoableActionDetails>> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), UNDOABLE_ACTIONS_STORAGE_KEY);
}

async function deleteTask(page: Page, text: string, completed = false) {
  await page.getByRole("button", { name: `Delete task: ${text}`, exact: true }).click();
  await expect(undoButton(page, text)).toBeVisible();
  await expect(taskCheckbox(page, text, completed)).toBeDisabled();
}

async function startClock(page: Page) {
  await page.clock.install({ time: new Date("2026-10-08T12:00:00Z") });
  await page.goto("/");
  await expect(newTaskInput(page)).toBeEnabled();
}

async function startPausedClock(page: Page) {
  await startClock(page);
  // Let initial loading finish before freezing time. The clock remains paused
  // across reload, so navigation and assertions cannot consume the undo window.
  await page.clock.pauseAt(new Date("2026-10-08T12:01:00Z"));
}

test("repeated keyboard create, edit, cancel, blur, completion and undo preserve distinct tasks", async ({ page }) => {
  await page.goto("/");
  const names = ["CI keyboard one", "CI keyboard two", "CI keyboard three"];
  for (const name of names) await createTask(page, name);
  await expect(page.getByRole("checkbox")).toHaveCount(3);

  await newTaskInput(page).fill("   ");
  await newTaskInput(page).press("Enter");
  await expect(page.getByRole("checkbox")).toHaveCount(3);
  await newTaskInput(page).clear();

  const editButton = page.getByRole("button", { name: `Edit task: ${names[0]}`, exact: true });
  await editButton.focus();
  await editButton.press("Enter");
  let editor = page.getByRole("textbox", { name: `Edit text for task: ${names[0]}`, exact: true });
  await expect(editor).toBeFocused();
  await editor.fill("CI cancelled keyboard edit");
  await editor.press("Escape");
  await expect(taskCheckbox(page, names[0])).toBeVisible();

  await editButton.focus();
  await editButton.press("Space");
  editor = page.getByRole("textbox", { name: `Edit text for task: ${names[0]}`, exact: true });
  await expect(editor).toHaveValue(names[0]);
  await editor.fill("  CI keyboard saved  ");
  await editor.press("Enter");
  await expect(taskCheckbox(page, "CI keyboard saved")).toBeVisible();

  await page.getByRole("button", { name: "Edit task: CI keyboard saved", exact: true }).click();
  editor = page.getByRole("textbox", { name: "Edit text for task: CI keyboard saved", exact: true });
  await editor.fill("CI blur saved");
  await newTaskInput(page).focus();
  await expect(taskCheckbox(page, "CI blur saved")).toBeVisible();
  await taskCheckbox(page, "CI blur saved").focus();
  await taskCheckbox(page, "CI blur saved").press("Space");
  await expect(taskCheckbox(page, "CI blur saved", true)).toBeChecked();
  await taskCheckbox(page, "CI blur saved", true).press("Space");
  await expect(taskCheckbox(page, "CI blur saved")).not.toBeChecked();

  for (let cycle = 0; cycle < 3; cycle += 1) {
    await deleteTask(page, "CI blur saved");
    await undoButton(page, "CI blur saved").press("Enter");
    await expect(taskCheckbox(page, "CI blur saved")).toBeEnabled();
    await expect(page.getByRole("checkbox")).toHaveCount(3);
  }
  await expect.poll(async () => (await readTodos(page)).map((todo) => todo.text)).toEqual([
    "CI blur saved", names[1], names[2],
  ]);
  const stored = await readTodos(page);
  expect(new Set(stored.map((todo) => todo.id)).size).toBe(3);
  expect(stored.every((todo) => !todo.isDeleted && todo.markedForDeletionAt === null)).toBe(true);
  await page.reload();
  for (const name of ["CI blur saved", names[1], names[2]]) {
    await expect(taskCheckbox(page, name)).toBeEnabled();
  }
});

test("task edits, completion, filter and search survive repeated reloads", async ({ page }) => {
  await page.goto("/");
  await createTask(page, "CI persistent alpha");
  await createTask(page, "CI persistent beta");
  await taskCheckbox(page, "CI persistent beta").click();
  await page.getByRole("button", { name: "Edit task: CI persistent beta", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Edit text for task: CI persistent beta", exact: true });
  await editor.fill("CI persistent edited");
  await editor.press("Enter");
  await page.locator('label[for="filter-completed"]').click();
  const search = page.getByRole("searchbox", { name: "Search tasks by keyword" });
  await search.fill("edited");
  for (let cycle = 0; cycle < 2; cycle += 1) {
    await page.reload();
    await expect(search).toHaveValue("edited");
    await expect(page.getByRole("radio", { name: "Completed", exact: true })).toBeChecked();
    await expect(taskCheckbox(page, "CI persistent edited", true)).toBeChecked();
    await expect(page.getByRole("checkbox")).toHaveCount(1);
  }
  await expect.poll(() => page.evaluate(({ filterKey, searchKey }) => ({
    filter: localStorage.getItem(filterKey), search: localStorage.getItem(searchKey),
  }), { filterKey: FILTER_STORAGE_KEY, searchKey: SEARCH_QUERY_STORAGE_KEY })).toEqual({
    filter: "completed", search: "edited",
  });
  await search.clear();
  await page.locator('label[for="filter-all"]').click();
  await page.reload();
  await expect(search).toHaveValue("");
  await expect(page.getByRole("radio", { name: "All", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox")).toHaveCount(2);
  await expect(taskCheckbox(page, "CI persistent alpha")).not.toBeChecked();
  await expect(taskCheckbox(page, "CI persistent edited", true)).toBeChecked();
});

test("pending delete survives reload and Undo restores the complete original task snapshot", async ({ page }) => {
  await startPausedClock(page);
  const text = "CI reload completed snapshot";
  await createTask(page, text);
  await taskCheckbox(page, text).click();
  await expect(taskCheckbox(page, text, true)).toBeChecked();
  await expect.poll(async () => (await readTodos(page))[0]?.completed).toBe(true);
  const [original] = await readTodos(page);
  const deletedAt = await page.evaluate(() => Date.now());
  const pending = {
    [original.id]: { id: original.id, actionType: "delete", timestamp: deletedAt, originalTodo: original },
  };

  await deleteTask(page, text, true);
  await expect.poll(() => readUndoableActions(page)).toEqual(pending);
  await expect.poll(() => readTodos(page)).toEqual([{ ...original, markedForDeletionAt: deletedAt }]);
  await page.clock.runFor(UNDO_TIMEOUT / 2);
  await page.reload();
  await expect(newTaskInput(page)).toBeEnabled();
  expect(await page.evaluate(() => Date.now())).toBe(deletedAt + UNDO_TIMEOUT / 2);
  await expect(undoButton(page, text)).toHaveAccessibleName(
    `Undo delete for task: ${text} (${UNDO_TIMEOUT / 2 / 1000}s remaining)`,
  );
  await expect(taskCheckbox(page, text, true)).toBeDisabled();
  await expect(taskCheckbox(page, text, true)).toBeChecked();
  await expect.poll(() => readUndoableActions(page)).toEqual(pending);

  await undoButton(page, text).click();
  await expect(taskCheckbox(page, text, true)).toBeEnabled();
  await expect(taskCheckbox(page, text, true)).toBeChecked();
  await expect(undoButton(page, text)).toHaveCount(0);
  await expect.poll(() => readTodos(page)).toEqual([original]);
  await expect.poll(() => readUndoableActions(page)).toEqual({});

  // The old deadline must not delete the restored task or recreate its action.
  await page.clock.runFor(UNDO_TIMEOUT / 2 + CURRENT_TIME_UPDATE_INTERVAL);
  await page.reload();
  await expect(taskCheckbox(page, text, true)).toBeEnabled();
  await expect(taskCheckbox(page, text, true)).toBeChecked();
  await expect(undoButton(page, text)).toHaveCount(0);
  await expect.poll(() => readTodos(page)).toEqual([original]);
  await expect.poll(() => readUndoableActions(page)).toEqual({});
});

test("pending delete expiry stays anchored to the original deletion time after reload", async ({ page }) => {
  await startPausedClock(page);
  const text = "CI reload original deadline";
  await createTask(page, text);
  const [original] = await readTodos(page);
  const deletedAt = await page.evaluate(() => Date.now());
  const pending = {
    [original.id]: { id: original.id, actionType: "delete", timestamp: deletedAt, originalTodo: original },
  };

  await deleteTask(page, text);
  await expect.poll(() => readUndoableActions(page)).toEqual(pending);
  await page.clock.runFor(UNDO_TIMEOUT / 2);
  await page.reload();
  await expect(newTaskInput(page)).toBeEnabled();
  expect(await page.evaluate(() => Date.now())).toBe(deletedAt + UNDO_TIMEOUT / 2);
  await expect(undoButton(page, text)).toBeVisible();
  await expect(taskCheckbox(page, text)).toBeDisabled();
  await expect.poll(() => readUndoableActions(page)).toEqual(pending);

  await page.clock.runFor(UNDO_TIMEOUT / 2 - 1);
  expect(await page.evaluate(() => Date.now())).toBe(deletedAt + UNDO_TIMEOUT - 1);
  await expect(undoButton(page, text)).toBeVisible();
  await expect.poll(() => readUndoableActions(page)).toEqual(pending);
  await page.clock.runFor(1);
  expect(await page.evaluate(() => Date.now())).toBe(deletedAt + UNDO_TIMEOUT);
  await expect(undoButton(page, text)).toHaveCount(0);
  await expect.poll(() => readUndoableActions(page)).toEqual({});

  // Moving the row to Deleted uses a separate, one-second current-time tick.
  await page.clock.runFor(CURRENT_TIME_UPDATE_INTERVAL);
  await expect(taskCheckbox(page, text)).toHaveCount(0);
  await expect.poll(() => readTodos(page)).toEqual([{ ...original, isDeleted: true }]);
  await page.locator('label[for="filter-deleted"]').click();
  await expect(page.getByRole("button", { name: `Restore task: ${text}`, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: `Restore task: ${text}`, exact: true })).toBeVisible();
  await expect(undoButton(page, text)).toHaveCount(0);
  await expect.poll(() => readUndoableActions(page)).toEqual({});
});

test("staggered delete timers expire independently across unrelated rerenders and repeated undo", async ({ page }) => {
  await startClock(page);
  await createTask(page, "CI early expiry");
  await createTask(page, "CI later undo");
  await deleteTask(page, "CI early expiry");
  await page.clock.runFor(UNDO_TIMEOUT / 2);
  await deleteTask(page, "CI later undo");

  const search = page.getByRole("searchbox", { name: "Search tasks by keyword" });
  await search.fill("CI later");
  await expect(page.getByRole("checkbox")).toHaveCount(1);
  await search.clear();
  await page.locator('label[for="filter-active"]').click();
  await page.clock.runFor(UNDO_TIMEOUT / 2 + 2_000);
  await expect(undoButton(page, "CI early expiry")).toHaveCount(0);
  await expect(taskCheckbox(page, "CI early expiry")).toHaveCount(0);
  await expect(undoButton(page, "CI later undo")).toBeVisible();
  await undoButton(page, "CI later undo").click();
  await expect(taskCheckbox(page, "CI later undo")).toBeEnabled();
  await page.clock.runFor(UNDO_TIMEOUT + 2_000);
  await expect(taskCheckbox(page, "CI later undo")).toBeEnabled();

  await deleteTask(page, "CI later undo");
  await page.clock.runFor(UNDO_TIMEOUT + 2_000);
  await expect(undoButton(page, "CI later undo")).toHaveCount(0);
  await page.locator('label[for="filter-deleted"]').click();
  for (const name of ["CI early expiry", "CI later undo"]) {
    await expect(page.getByRole("button", { name: `Restore task: ${name}`, exact: true })).toBeVisible();
  }
  await expect.poll(async () => (await readTodos(page)).every((todo) => todo.isDeleted && todo.markedForDeletionAt === null)).toBe(true);
  await page.reload();
  await expect(page.getByRole("checkbox")).toHaveCount(2);
  await expect(page.getByRole("radio", { name: "Deleted", exact: true })).toBeChecked();
});

test("trash expiry supports batch restore without duplicate tasks and its restore window expires", async ({ page }) => {
  await startClock(page);
  for (const name of ["CI trash one", "CI trash two"]) {
    await createTask(page, name);
    await deleteTask(page, name);
  }
  await page.clock.runFor(UNDO_TIMEOUT + 2_000);
  await page.locator('label[for="filter-deleted"]').click();
  const clearDeleted = page.getByRole("button", { name: "Initiate permanent deletion for 2 deleted tasks", exact: true });
  await expect(clearDeleted).toBeEnabled();
  await clearDeleted.click();
  await expect(page.getByRole("button", { name: /^Undo permanent deletion for task\./ })).toHaveCount(2);
  await page.clock.runFor(STAGE_2_GRACE_PERIOD_DURATION + AUTO_FINAL_DELETE_INTERVAL + 1_000);
  const restoreBatch = page.getByRole("button", { name: /^Restore 2 tasks from recently cleared batch\./ });
  await expect(restoreBatch).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect.poll(async () => (await readTodos(page)).length).toBe(0);
  await restoreBatch.click();
  await expect(page.getByRole("checkbox")).toHaveCount(2);
  await expect(restoreBatch).toHaveCount(0);
  await expect(clearDeleted).toBeEnabled();
  const restored = await readTodos(page);
  expect(new Set(restored.map((todo) => todo.id)).size).toBe(2);
  expect(restored.every((todo) => todo.isDeleted && todo.pendingFinalDeletionTimestamp === null)).toBe(true);

  await clearDeleted.click();
  await page.clock.runFor(STAGE_2_GRACE_PERIOD_DURATION + AUTO_FINAL_DELETE_INTERVAL + 1_000);
  await expect(restoreBatch).toBeVisible();
  await page.clock.fastForward(STAGE_4_GLOBAL_RESTORE_WINDOW + 1_000);
  await expect(restoreBatch).toHaveCount(0);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page.reload();
  await expect(restoreBatch).toHaveCount(0);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
});


test("keyboard and bubbling click activity each restart the input-focus timer", async ({ page }) => {
  await startClock(page);
  const search = page.getByRole("searchbox", { name: "Search tasks by keyword" });
  await search.focus();
  await search.press("ArrowLeft");
  await page.clock.runFor(INACTIVITY_TIMEOUT - 1_000);
  await search.press("ArrowRight");
  await page.clock.runFor(1_500);
  await expect(search).toBeFocused();
  await page.clock.runFor(INACTIVITY_TIMEOUT);
  await expect(newTaskInput(page)).toBeFocused();

  await search.focus();
  await search.press("ArrowLeft");
  await page.clock.runFor(INACTIVITY_TIMEOUT - 1_000);
  // Dispatch only click so mousemove does not conceal a missing click listener.
  await page.getByText("Your Tasks", { exact: true }).dispatchEvent("click");
  await page.clock.runFor(1_500);
  await expect(search).toBeFocused();
  await page.clock.runFor(INACTIVITY_TIMEOUT);
  await expect(newTaskInput(page)).toBeFocused();
});
