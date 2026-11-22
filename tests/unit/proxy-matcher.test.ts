import { expect, test } from "@jest/globals";

import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";

import { config } from "../../src/proxy";

function matches(url: string) {
  return unstable_doesMiddlewareMatch({
    config,
    nextConfig: {},
    url,
  });
}

test("matches every protected staff route prefix", () => {
  for (const url of [
    "/admin",
    "/admin/products",
    "/manager",
    "/manager/waiter-orders",
    "/cashier",
    "/cashier/order",
    "/waiter",
    "/kitchen",
    "/kitchen/barista",
    "/inventory",
  ]) {
    expect({ context: url, value: matches(url) }).toStrictEqual({ context: url, value: true });
  }
});

test("does not match public, static, or API requests", () => {
  for (const url of [
    "/",
    "/menu",
    "/customer",
    "/file.svg",
    "/menu-hero-bg.webp",
    "/logo.png",
    "/newer_logo.png",
    "/favicon.ico",
    "/_next/static/chunks/app.js",
    "/_next/image?url=%2Flogo.png",
    "/api/me",
    "/api/orders",
  ]) {
    expect({ context: url, value: matches(url) }).toStrictEqual({ context: url, value: false });
  }
});
