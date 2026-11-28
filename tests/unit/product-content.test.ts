import assert from "node:assert/strict";
import test from "node:test";

import { parseProductMenuContent } from "../../src/lib/products/product-content";

test("trims menu content and accepts site-relative images", () => {
  assert.deepEqual(
    parseProductMenuContent("  Freshly grilled chicken  ", " /images/chicken.jpg "),
    {
      description: "Freshly grilled chicken",
      imageUrl: "/images/chicken.jpg",
    },
  );
});

test("accepts a web image URL and distinguishes cleared and omitted fields", () => {
  assert.deepEqual(parseProductMenuContent(null, " HTTPS://cdn.example.com/item.jpg "), {
    imageUrl: "https://cdn.example.com/item.jpg",
  });
  assert.deepEqual(parseProductMenuContent(" ", ""), {
    description: null,
    imageUrl: null,
  });
  assert.deepEqual(parseProductMenuContent(null, null), {});
});

test("rejects invalid image URLs and ambiguous paths", () => {
  for (const url of [
    "ftp://example.com/item.jpg",
    "//example.com/item.jpg",
    "/\\example.com/item.jpg",
    "/\t/example.com/item.jpg",
    "https://",
  ]) {
    assert.throws(() => parseProductMenuContent(null, url), /Enter an HTTP\(S\) URL or a path/);
  }
});

test("enforces menu content length limits", () => {
  assert.throws(
    () => parseProductMenuContent("x".repeat(1001), null),
    /Menu description must be 1000 characters or fewer/,
  );
  assert.throws(
    () => parseProductMenuContent(null, `/images/${"x".repeat(2048)}`),
    /Use 2048 characters or fewer/,
  );
});
