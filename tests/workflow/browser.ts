import {
  expect,
  test as playwrightTest,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Locator,
  type Page,
} from "@playwright/test";
import { appUrl, sessionCookies, type TestUser } from "./fixtures";

async function blockHotReload(context: BrowserContext) {
  // Test files and trace artifacts are written during runs. Keep those
  // filesystem events from reloading active pages through Next's dev socket.
  await context.routeWebSocket(
    (url) => url.pathname === "/_next/hmr",
    (socket) => {
      const upstream = socket.connectToServer();
      upstream.onMessage((message) => {
        if (typeof message !== "string") {
          socket.send(message);
          return;
        }
        const event = JSON.parse(message) as { type?: string };
        if (
          event.type !== "reloadPage" &&
          event.type !== "serverComponentChanges" &&
          event.type !== "turbopack-message"
        ) {
          socket.send(message);
        }
      });
    },
  );
}

export const test = playwrightTest.extend<{ stableContext: void }>({
  stableContext: [
    async ({ context }, use) => {
      await blockHotReload(context);
      await use();
    },
    { auto: true },
  ],
});

export async function login(page: Page, account: TestUser, landing: string) {
  await page.goto("/staff-login");
  await page.getByPlaceholder("admin@pos.com").fill(account.email);
  await page.getByPlaceholder("Enter password").fill(account.password);
  await page.getByRole("button", { name: "Sign in to staff" }).click();
  await expect(page).toHaveURL(new URL(landing, appUrl).href);
}

export async function session(
  browser: Browser,
  account: TestUser,
  options?: BrowserContextOptions,
) {
  const context = await browser.newContext({ baseURL: appUrl, ...options });
  await blockHotReload(context);
  await context.addCookies(
    (await sessionCookies(account)).map((cookie) => ({ ...cookie, url: appUrl })),
  );
  return context;
}

export function kitchenCard(page: Page, productName: string) {
  return page.getByRole("article").filter({
    has: page.getByText(productName, { exact: true }),
    hasText: "Dhammaay",
  });
}

export async function stationAction(page: Page, productName: string, label: "Bilow" | "Dhammaay") {
  const button = kitchenCard(page, productName).getByRole("button", { name: label, exact: true });
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.request().method() === "PATCH" &&
        new URL(candidate.url()).pathname.endsWith("/station"),
    ),
    button.click(),
  ]);
  expect(response.ok(), await response.text()).toBe(true);
}

export async function pickupAction(page: Page, button: Locator, orderId: string) {
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.request().method() === "PATCH" &&
        new URL(candidate.url()).pathname === `/api/kitchen/tickets/${orderId}/pickup`,
    ),
    button.click(),
  ]);
  expect(response.ok(), await response.text()).toBe(true);
}
