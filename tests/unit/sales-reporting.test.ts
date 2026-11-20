import { expect, test } from "@jest/globals";

import { resolveReportRange } from "../../src/lib/reports/resolve-range";
import { reportQuerySchema } from "../../src/lib/reports/validation";

const now = new Date("2026-07-18T12:00:00.000Z");
const query = (value: Record<string, unknown>) => reportQuerySchema.parse(value);

test("resolves current, yesterday, and last-seven-day business ranges", () => {
  expect(resolveReportRange(query({}), now).start.toISOString()).toBe("2026-07-18T04:00:00.000Z");
  expect(resolveReportRange(query({ preset: "yesterday" }), now).start.toISOString()).toBe(
    "2026-07-17T04:00:00.000Z",
  );
  const last7 = resolveReportRange(query({ preset: "last7Days" }), now);
  expect(last7.start.toISOString()).toBe("2026-07-12T04:00:00.000Z");
  expect(last7.end.toISOString()).toBe("2026-07-19T02:00:00.000Z");
});

test("resolves Saturday weeks and calendar months", () => {
  expect(resolveReportRange(query({ preset: "thisWeek" }), now).start.toISOString()).toBe(
    "2026-07-18T04:00:00.000Z",
  );
  expect(resolveReportRange(query({ preset: "lastWeek" }), now).start.toISOString()).toBe(
    "2026-07-11T04:00:00.000Z",
  );
  expect(resolveReportRange(query({ preset: "thisMonth" }), now).start.toISOString()).toBe(
    "2026-07-01T04:00:00.000Z",
  );
  expect(resolveReportRange(query({ preset: "lastMonth" }), now).start.toISOString()).toBe(
    "2026-06-01T04:00:00.000Z",
  );
});

test("includes the complete end business day for custom ranges", () => {
  const range = resolveReportRange(
    query({ preset: "custom", from: "2026-07-10", to: "2026-07-12" }),
    now,
  );
  expect(range.start.toISOString()).toBe("2026-07-10T04:00:00.000Z");
  expect(range.end.toISOString()).toBe("2026-07-13T02:00:00.000Z");
});
