import { test, expect } from "@playwright/test";

// No credentials, production data, or outbound actions. Remote task artwork is
// fulfilled locally so synthetic todo IDs never reach the image provider.
const imageFixture = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4DwQACfsD/fteaysAAAAASUVORK5CYII=",
  "base64",
);
let runtimeErrors: string[];
let unexpectedRequests: string[];

test.beforeEach(async ({ page }) => {
  runtimeErrors = [];
  unexpectedRequests = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    const imageSource = url.searchParams.get("url");
    if (
      url.hostname === "picsum.photos" ||
      (url.pathname === "/_next/image" && imageSource?.startsWith("https://picsum.photos/"))
    ) {
      await route.fulfill({ status: 200, contentType: "image/png", body: imageFixture });
    } else if (url.origin === "http://127.0.0.1:4173") {
      await route.continue();
    } else {
      unexpectedRequests.push(`${route.request().method()} ${url.origin}${url.pathname}`);
      await route.abort();
    }
  });
});

test.afterEach(() => {
  expect(runtimeErrors, "browser runtime and hydration errors").toEqual([]);
  expect(unexpectedRequests, "unexpected external requests").toEqual([]);
});

test("unknown routes return 404", async ({ request }) => {
  const response = await request.get("/ci-smoke-missing-route");
  expect(response.status()).toBe(404);
});

test("todo create, persistence, completion, editing, search and undo", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  const original = "CI synthetic task";
  const edited = `${original} edited`;
  const addInput = page.getByRole("textbox", { name: "New task text" });
  await expect(addInput).toBeEnabled();
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
