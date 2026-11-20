import { expect, test } from "@jest/globals";

import { queryStringWithoutPage } from "../../src/components/admin/shared/ui/queryStringWithoutPage";
import {
  isValidDateKey,
  normalizeDateFilter,
  normalizeFilterChoice,
} from "../../src/lib/admin/admin-filters";

test("normalizes allowed filter choices and rejects unknown values", () => {
  const allowed = ["all", "active", "inactive"] as const;

  expect(normalizeFilterChoice("active", allowed, "all")).toBe("active");
  expect(normalizeFilterChoice("archived", allowed, "all")).toBe("all");
  expect(normalizeFilterChoice(undefined, allowed, "all")).toBe("all");
});

test("validates calendar date keys rather than only their shape", () => {
  expect(isValidDateKey("2026-02-28")).toBe(true);
  expect(isValidDateKey("2024-02-29")).toBe(true);
  expect(isValidDateKey("2026-02-29")).toBe(false);
  expect(isValidDateKey("2026-13-01")).toBe(false);
  expect(isValidDateKey("08/09/2026")).toBe(false);
});

test("normalizes dates against the page's allowed bounds", () => {
  const fallback = "2026-08-09";

  expect(
    normalizeDateFilter("2026-08-08", fallback, {
      min: "2026-07-01",
      max: "2026-08-09",
    }),
  ).toBe("2026-08-08");
  expect(normalizeDateFilter("2026-06-30", fallback, { min: "2026-07-01" })).toBe(fallback);
  expect(normalizeDateFilter("2026-08-10", fallback, { max: "2026-08-09" })).toBe(fallback);
  expect(normalizeDateFilter("2026-02-29", fallback)).toBe(fallback);
});

test("pagination links preserve filters while omitting the current page", () => {
  expect(
    queryStringWithoutPage({
      page: "4",
      q: "iced coffee",
      status: "active",
      category: "",
    }),
  ).toBe("?q=iced+coffee&status=active");
  expect(queryStringWithoutPage({ page: "2" })).toBe("");
});
