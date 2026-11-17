import assert from "node:assert/strict";
import test from "node:test";
import {
  getProductImagePath,
  getPublicProductImageUrl,
} from "../../src/lib/products/product-images";
import {
  getProductImageRemotePatterns,
  PRODUCT_FALLBACK_IMAGE_PATH,
} from "../../src/lib/products/product-image-config";

const host = "https://images.example.supabase.co";

test("extracts legacy signed and public paths, decoding URL characters exactly once", () => {
  for (const mode of ["sign", "public"]) {
    assert.equal(
      getProductImagePath(
        host +
          "/storage/v1/object/" +
          mode +
          "/IMG_Products/New%20Photos/tea%20cup.webp?token=expired",
        host,
      ),
      "New Photos/tea cup.webp",
    );
    assert.equal(
      getProductImagePath(host + "/storage/v1/object/" + mode + "/IMG_Products/100%25.webp", host),
      "100%.webp",
    );
    assert.equal(
      getProductImagePath(
        host + "/storage/v1/object/" + mode + "/IMG_Products/literal%2520name.webp",
        host,
      ),
      "literal%20name.webp",
    );
  }
  assert.equal(getProductImagePath(" New Photos/tea cup.webp ", host), "New Photos/tea cup.webp");
});

test("rejects other buckets and hosts, malformed URLs, and unsafe paths", () => {
  for (const source of [
    null,
    undefined,
    "",
    "  ",
    "/menu-hero-bg.webp",
    "//other.example/image.webp",
    "javascript:alert(1)",
    "data:image/svg+xml,x",
    "../image.webp",
    "folder/../image.webp",
    "folder\\image.webp",
    host + "/storage/v1/object/sign/receipts/invoice.png?token=x",
    "https://other.supabase.co/storage/v1/object/public/IMG_Products/a.webp",
    host + "/storage/v1/object/public/IMG_Products/%E0%A4",
    host + "/storage/v1/object/public/IMG_Products/",
  ])
    assert.equal(getProductImagePath(source, host), null, String(source));
});

test("generates permanent public URLs without sending requests or retaining signed tokens", () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = host;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "public-test-key";
  try {
    const expected = host + "/storage/v1/object/public/IMG_Products/New%20Photos/tea%20cup.webp";
    const signed =
      host + "/storage/v1/object/sign/IMG_Products/New%20Photos/tea%20cup.webp?token=expired";
    assert.equal(getPublicProductImageUrl(signed), expected);
    assert.equal(getPublicProductImageUrl(expected), expected);
    assert.equal(getPublicProductImageUrl("New Photos/tea cup.webp"), expected);
    assert.equal(
      getPublicProductImageUrl("literal%20name.webp"),
      host + "/storage/v1/object/public/IMG_Products/literal%2520name.webp",
    );
    assert.equal(getPublicProductImageUrl(null), null);
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    assert.equal(getPublicProductImageUrl("image.webp"), null);
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  }
});

test("the optimizer allowlist covers only this project's public product images", () => {
  assert.deepEqual(getProductImageRemotePatterns(host), [
    {
      protocol: "https",
      hostname: "images.example.supabase.co",
      port: "",
      pathname: "/storage/v1/object/public/IMG_Products/**",
      search: "",
    },
  ]);
  assert.deepEqual(getProductImageRemotePatterns("http://example.com"), []);
  assert.deepEqual(getProductImageRemotePatterns("https://name:password@example.com"), []);
  assert.deepEqual(getProductImageRemotePatterns("https://example.com:444"), []);
  assert.equal(PRODUCT_FALLBACK_IMAGE_PATH, "placeholder/product-fallback.webp");
});
