import { expect, test } from "@jest/globals";

import { parseProductMenuContent } from "../../src/lib/products/product-content";

test("trims menu content and accepts site-relative images", () => {
  expect(
    parseProductMenuContent("  Freshly grilled chicken  ", " /images/chicken.jpg "),
  ).toStrictEqual({
    description: "Freshly grilled chicken",
    imageUrl: "/images/chicken.jpg",
  });
});

test("accepts a web image URL and distinguishes cleared and omitted fields", () => {
  expect(parseProductMenuContent(null, " HTTPS://cdn.example.com/item.jpg ")).toStrictEqual({
    imageUrl: "https://cdn.example.com/item.jpg",
  });
  expect(parseProductMenuContent(" ", "")).toStrictEqual({
    description: null,
    imageUrl: null,
  });
  expect(parseProductMenuContent(null, null)).toStrictEqual({});
});

test("rejects invalid image URLs and ambiguous paths", () => {
  for (const url of [
    "ftp://example.com/item.jpg",
    "//example.com/item.jpg",
    "/\\example.com/item.jpg",
    "/\t/example.com/item.jpg",
    "https://",
  ]) {
    expect(() => parseProductMenuContent(null, url)).toThrow(/Enter an HTTP\(S\) URL or a path/);
  }
});

test("enforces menu content length limits", () => {
  expect(() => parseProductMenuContent("x".repeat(1001), null)).toThrow(
    /Menu description must be 1000 characters or fewer/,
  );
  expect(() => parseProductMenuContent(null, `/images/${"x".repeat(2048)}`)).toThrow(
    /Use 2048 characters or fewer/,
  );
});
