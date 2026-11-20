import { expect } from "expect";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";

// Use available browser tooling via NODE_PATH; no application dependency is added.
const requireTool = createRequire(import.meta.url);
const { chromium } = requireTool("playwright");
const { getDocument } = requireTool("pdfjs-dist/legacy/build/pdf.mjs");
const output = join(process.cwd(), ".next", "receipt-print-check");
const chrome =
  process.env.CHROME_PATH ??
  [
    join(process.env.ProgramFiles ?? "C:/Program Files", "Google/Chrome/Application/chrome.exe"),
    join(process.env.LOCALAPPDATA ?? "", "Google/Chrome/Application/chrome.exe"),
  ].find(existsSync);
const server = createServer((request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (pathname === "/client.js") {
    response.setHeader("Content-Type", "text/javascript");
    response.end(readFileSync(join(output, "client.js")));
    return;
  }
  if (pathname === "/newer_logo.png") {
    response.setHeader("Content-Type", "image/png");
    response.end(readFileSync("public/newer_logo.png"));
    return;
  }
  const name =
    pathname === "/print/orders/fixture/thermal-receipt"
      ? "thermal"
      : pathname === "/print/orders/fixture"
        ? "full"
        : pathname.slice(1).replace(/\.html$/, "");
  if (!["full", "thermal", "large", "oversized"].includes(name)) {
    response.writeHead(404).end();
    return;
  }
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.end(readFileSync(join(output, `${name}.html`)));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ executablePath: chrome, headless: true });
  const page = await browser.newPage({
    viewport: { width: 1200, height: 1000 },
  });
  await page.addInitScript(() => {
    window.print = () => {
      window.receiptPrintCalls = (window.receiptPrintCalls ?? 0) + 1;
    };
  });
  await page.goto(`${base}/thermal.html`);
  await page.waitForFunction(() => window.receiptActionsHydrated === true);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: join(output, "thermal-desktop.png"),
    fullPage: true,
  });
  for (const width of [1200, 375, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect({
      context: `Overflow at ${width}px`,
      value: Boolean(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)),
    }).toStrictEqual({ context: `Overflow at ${width}px`, value: true });
  }
  await page.screenshot({
    path: join(output, "thermal-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Print Receipt", exact: true }).click();
  await page.getByRole("button", { name: "Save as PDF", exact: true }).click();
  expect(await page.evaluate(() => window.receiptPrintCalls)).toBe(2);
  await page.getByRole("link", { name: "Full Page Receipt", exact: true }).click();
  expect(await page.locator(".thermal-receipt").count()).toBe(0);
  expect({
    context: "Thermal @page leaked into full format",
    value: Boolean(
      !(await page.locator("style").allTextContents()).join("").includes("80mm 200mm"),
    ),
  }).toStrictEqual({ context: "Thermal @page leaked into full format", value: true });
  await page.getByRole("link", { name: "80 mm Thermal Receipt", exact: true }).click();
  await page.emulateMedia({ media: "print" });
  expect(await page.locator(".no-print").isVisible()).toBe(false);
  const contentWidth = await page
    .locator(".thermal-receipt")
    .evaluate((element) => element.getBoundingClientRect().width);
  expect({
    context: `Print content width ${contentWidth}`,
    value: Boolean(Math.abs(contentWidth - (72 * 96) / 25.4) < 1),
  }).toStrictEqual({ context: `Print content width ${contentWidth}`, value: true });

  for (const name of ["thermal", "large", "oversized", "full"]) {
    await page.emulateMedia({ media: "screen" });
    await page.goto(`${base}/${name}.html`);
    expect({
      context: `${name} overflows on mobile`,
      value: Boolean(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)),
    }).toStrictEqual({ context: `${name} overflows on mobile`, value: true });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.images, (image) => image.decode().catch(() => {})));
    });
    await page.emulateMedia({ media: "print" });
    const file = join(output, `${name}.pdf`);
    const bytes = await page.pdf({
      path: file,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
    });
    const pdf = await PDFDocument.load(bytes);
    for (const sheet of pdf.getPages()) {
      const widthMm = (sheet.getWidth() * 25.4) / 72;
      if (name === "full")
        expect({
          context: `Full-page width ${widthMm}`,
          value: Boolean(widthMm > 200),
        }).toStrictEqual({ context: `Full-page width ${widthMm}`, value: true });
      else {
        expect({
          context: `${name} PDF width ${widthMm}`,
          value: Boolean(Math.abs(widthMm - 80) < 0.5),
        }).toStrictEqual({ context: `${name} PDF width ${widthMm}`, value: true });
        expect(Math.abs((sheet.getHeight() * 25.4) / 72 - 200) < 0.5).toBeTruthy();
      }
    }
    if (name === "thermal") expect(pdf.getPageCount()).toBe(1);
    if (["large", "oversized"].includes(name)) expect(pdf.getPageCount() > 1).toBeTruthy();
    const textDocument = await getDocument({
      data: new Uint8Array(bytes),
      useSystemFonts: true,
    }).promise;
    const textPages = [];
    for (let pageNumber = 1; pageNumber <= textDocument.numPages; pageNumber++) {
      const sheet = await textDocument.getPage(pageNumber);
      const content = await sheet.getTextContent();
      textPages.push(
        content.items.map((item) => (item.str ?? "") + (item.hasEOL ? "\n" : " ")).join(""),
      );
    }
    await textDocument.destroy();
    const text = textPages.join("\f");
    expect({
      context: `${name} footer missing`,
      value: Boolean(text.includes("Thank you for visiting!")),
    }).toStrictEqual({ context: `${name} footer missing`, value: true });
    expect({
      context: `${name} controls printed`,
      value: Boolean(!text.includes("Save as PDF")),
    }).toStrictEqual({ context: `${name} controls printed`, value: true });
    if (name !== "full") expect(!text.includes("Private Customer Name")).toBeTruthy();
    if (name === "large") {
      for (let index = 1; index <= 100; index++)
        expect({
          context: `Missing item ${index}`,
          value: Boolean(text.includes(`Item ${String(index).padStart(3, "0")}`)),
        }).toStrictEqual({ context: `Missing item ${index}`, value: true });
      expect(text.includes("$197.50")).toBeTruthy();
    }
    if (name === "oversized") {
      expect(text.includes("Extra modifier 180")).toBeTruthy();
      expect({
        context: "Oversized item was unnecessarily pushed off the first page",
        value: Boolean(textPages[0].includes("Extra modifier 1")),
      }).toStrictEqual({
        context: "Oversized item was unnecessarily pushed off the first page",
        value: true,
      });
    }
    const nonemptyPages = text.split("\f").filter((value) => value.trim());
    expect({ context: `${name} has a blank page`, value: nonemptyPages.length }).toStrictEqual({
      context: `${name} has a blank page`,
      value: pdf.getPageCount(),
    });
    console.log(
      `${name}: ${pdf.getPageCount()} PDF page(s), ${(pdf.getPage(0).getWidth() * 25.4) / 72} mm wide`,
    );
  }
  console.log(
    "PASS: format navigation, print actions, mobile layout, print visibility, PDF dimensions and complete pagination",
  );
} finally {
  await browser?.close();
  server.close();
}
