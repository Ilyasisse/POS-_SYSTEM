import assert from "node:assert/strict";
import test from "node:test";
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
    assert.equal(matches(url), true, url);
  }
});

test("does not match public, static, or API requests", () => {
  for (const url of [
    "/",
    "/menu",
    "/customer",
    "/file.svg",
    "/menu-hero-bg.svg",
    "/logo.png",
    "/newer_logo.png",
    "/favicon.ico",
    "/_next/static/chunks/app.js",
    "/_next/image?url=%2Flogo.png",
    "/api/me",
    "/api/orders",
  ]) {
    assert.equal(matches(url), false, url);
  }
});