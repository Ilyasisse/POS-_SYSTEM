import assert from "node:assert/strict";
import test from "node:test";
import { queryStringWithoutPage } from "../../src/components/admin/shared/ui/queryStringWithoutPage";
import {
  isValidDateKey,
  normalizeDateFilter,
  normalizeFilterChoice,
} from "../../src/lib/admin/admin-filters";

test("normalizes allowed filter choices and rejects unknown values", () => {
  const allowed = ["all", "active", "inactive"] as const;

  assert.equal(normalizeFilterChoice("active", allowed, "all"), "active");
  assert.equal(normalizeFilterChoice("archived", allowed, "all"), "all");
  assert.equal(normalizeFilterChoice(undefined, allowed, "all"), "all");
});

test("validates calendar date keys rather than only their shape", () => {
  assert.equal(isValidDateKey("2026-02-28"), true);
  assert.equal(isValidDateKey("2024-02-29"), true);
  assert.equal(isValidDateKey("2026-02-29"), false);
  assert.equal(isValidDateKey("2026-13-01"), false);
  assert.equal(isValidDateKey("08/09/2026"), false);
});

test("normalizes dates against the page's allowed bounds", () => {
  const fallback = "2026-08-09";

  assert.equal(
    normalizeDateFilter("2026-08-08", fallback, {
      min: "2026-07-01",
      max: "2026-08-09",
    }),
    "2026-08-08",
  );
  assert.equal(
    normalizeDateFilter("2026-06-30", fallback, { min: "2026-07-01" }),
    fallback,
  );
  assert.equal(
    normalizeDateFilter("2026-08-10", fallback, { max: "2026-08-09" }),
    fallback,
  );
  assert.equal(normalizeDateFilter("2026-02-29", fallback), fallback);
});

test("pagination links preserve filters while omitting the current page", () => {
  assert.equal(
    queryStringWithoutPage({
      page: "4",
      q: "iced coffee",
      status: "active",
      category: "",
    }),
    "?q=iced+coffee&status=active",
  );
  assert.equal(queryStringWithoutPage({ page: "2" }), "");
});
