import assert from "node:assert/strict";
import test from "node:test";

import { parseProductMenuContent } from "../../src/lib/products/product-content";

test("normalizes optional product menu content", () => {
  assert.deepEqual(
    parseProductMenuContent({
      description: "  Freshly grilled chicken  ",
      imageUrl: " /images/chicken.jpg ",
      isActive: "on",
      isPopular: "on",
    }),
    {
      description: "Freshly grilled chicken",
      imageUrl: "/images/chicken.jpg",
      isActive: true,
      isPopular: true,
    },
  );
});

test("supports remote http images and clears blank optional fields", () => {
  assert.deepEqual(
    parseProductMenuContent({ imageUrl: "https://cdn.example.com/item.jpg" }),
    {
      description: null,
      imageUrl: "https://cdn.example.com/item.jpg",
      isActive: false,
      isPopular: false,
    },
  );
});

test("rejects unsafe image URL schemes", () => {
  assert.throws(
    () => parseProductMenuContent({ imageUrl: "javascript:alert(1)" }),
    /http\(s\) URL or a site-relative path/,
  );
  assert.throws(
    () => parseProductMenuContent({ imageUrl: "//untrusted.example/item.jpg" }),
    /http\(s\) URL or a site-relative path/,
  );
});

test("enforces menu content length limits", () => {
  assert.throws(
    () => parseProductMenuContent({ description: "x".repeat(1001) }),
    /Description must be 1000 characters or fewer/,
  );
});
