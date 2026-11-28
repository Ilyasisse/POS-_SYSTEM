import assert from "node:assert/strict";
import test from "node:test";
import {
  getMenuImageRemotePatterns,
  shouldOptimizeMenuImage,
} from "../../src/lib/menu/image-optimization";

const project = "https://cafe-project.supabase.co";
const publicImage = `${project}/storage/v1/object/public/menu/chicken.webp`;
const signedImage = `${project}/storage/v1/object/sign/IMG_Products/New%20Photos/chicken.webp`;

test("restricts remote patterns to public storage and the signed product bucket", () => {
  assert.deepEqual(getMenuImageRemotePatterns(project), [
    {
      protocol: "https",
      hostname: "cafe-project.supabase.co",
      port: "",
      pathname: "/storage/v1/object/public/**",
      search: "",
    },
    {
      protocol: "https",
      hostname: "cafe-project.supabase.co",
      port: "",
      pathname: "/storage/v1/object/sign/IMG_Products/**",
    },
  ]);
  assert.equal(shouldOptimizeMenuImage(publicImage, project), true);
});

test("optimizes signed product photos with exactly one nonempty token", () => {
  for (const token of ["example", "header.payload.signature", "a%2Bb%2Fc%3D"]) {
    assert.equal(shouldOptimizeMenuImage(`${signedImage}?token=${token}`, project), true);
  }
});

test("keeps missing, blank, duplicate, and unsupported signed queries direct", () => {
  for (const suffix of [
    "",
    "?token=",
    "?token=%20%20",
    "?token=first&token=second",
    "?token=first&width=640",
    "?token=first&download=true",
    "?Token=example",
    "?download=true",
  ]) {
    assert.equal(shouldOptimizeMenuImage(`${signedImage}${suffix}`, project), false, suffix);
  }
});

test("keeps other private buckets, authenticated storage, and public queries direct", () => {
  for (const src of [
    `${project}/storage/v1/object/sign/receipts/chicken.webp?token=example`,
    `${project}/storage/v1/object/sign/IMG_Products-copy/chicken.webp?token=example`,
    `${project}/storage/v1/object/sign/img_products/chicken.webp?token=example`,
    `${project}/storage/v1/object/sign/IMG_Products/?token=example`,
    `${project}/storage/v1/object/authenticated/IMG_Products/chicken.webp`,
    `${publicImage}?v=2`,
  ]) {
    assert.equal(shouldOptimizeMenuImage(src, project), false, src);
  }
});

test("does not proxy other hosts, insecure URLs, ports, or credential-bearing URLs", () => {
  for (const source of [publicImage, `${signedImage}?token=example`]) {
    for (const src of [
      source.replace("cafe-project", "another-project"),
      source.replace(".supabase.co", ".supabase.co.example.com"),
      source.replace("https:", "http:"),
      source.replace(".supabase.co", ".supabase.co:8443"),
      source.replace("https://", "https://user:password@"),
      source.replace("https:", ""),
    ]) {
      assert.equal(shouldOptimizeMenuImage(src, project), false, src);
    }
  }
});

test("optimizes local assets and preserves inline fallback artwork", () => {
  assert.equal(shouldOptimizeMenuImage("/menu-hero-bg.webp", project), true);
  assert.equal(shouldOptimizeMenuImage("data:image/svg+xml,%3Csvg%3E%3C/svg%3E", project), false);
});

test("missing or invalid configuration never opens remote optimization", () => {
  for (const config of [undefined, "", "invalid", "http://localhost:54321", `${project}:8443`]) {
    assert.deepEqual(getMenuImageRemotePatterns(config), []);
    assert.equal(shouldOptimizeMenuImage(publicImage, config), false);
    assert.equal(shouldOptimizeMenuImage(`${signedImage}?token=example`, config), false);
    assert.equal(shouldOptimizeMenuImage("/newer_logo.png", config), true);
  }
});

test("keeps query-bearing local assets and malformed sources on direct loading", () => {
  for (const src of ["/photo.webp?v=2", "not a URL", "https://", ""]) {
    assert.equal(shouldOptimizeMenuImage(src, project), false, src);
  }
});
