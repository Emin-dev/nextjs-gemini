import { expect, test as base } from "@playwright/test";

// Synthetic browser data only. Fulfill artwork before either a provider request
// or a Next image-optimizer request; block every other off-origin request.
const imageFixture = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4DwQACfsD/fteaysAAAAASUVORK5CYII=",
  "base64",
);

export const test = base.extend<{ localRuntime: undefined }>({
  localRuntime: [async ({ page }, use) => {
    const runtimeErrors: string[] = [];
    const unexpectedRequests: string[] = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(message.text());
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      const imageSource = url.searchParams.get("url");
      if (
        url.hostname === "picsum.photos" ||
        (url.origin === "http://127.0.0.1:4173" &&
          url.pathname === "/_next/image" &&
          imageSource?.startsWith("https://picsum.photos/"))
      ) {
        await route.fulfill({ status: 200, contentType: "image/png", body: imageFixture });
      } else if (url.origin === "http://127.0.0.1:4173") {
        await route.continue();
      } else {
        unexpectedRequests.push(`${route.request().method()} ${url.origin}${url.pathname}`);
        await route.abort();
      }
    });
    await use(undefined);
    expect(runtimeErrors, "browser runtime and hydration errors").toEqual([]);
    expect(unexpectedRequests, "unexpected external requests").toEqual([]);
  }, { auto: true }],
});

export { expect };
