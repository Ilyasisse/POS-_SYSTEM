import assert from "node:assert/strict";
import test from "node:test";
import {
  SHIFT_BROWSER_PAGE_SIZE,
  shiftBrowserPage,
} from "../../src/lib/staff/shift-browser-page";

test("shift pages reach later upcoming shifts and clamp invalid pages", () => {
  assert.deepEqual(shiftBrowserPage("2", SHIFT_BROWSER_PAGE_SIZE + 2), {
    page: 2,
    pageCount: 2,
    skip: SHIFT_BROWSER_PAGE_SIZE,
  });
  assert.equal(shiftBrowserPage("100", 27).page, 2);
  assert.equal(shiftBrowserPage("-1", 27).page, 1);
  assert.equal(shiftBrowserPage("1.5", 27).page, 1);
  assert.deepEqual(shiftBrowserPage("6", 0), {
    page: 1,
    pageCount: 1,
    skip: 0,
  });
});
