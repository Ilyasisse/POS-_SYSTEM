import assert from "node:assert/strict";
import test from "node:test";
import {
  ATTENDANCE_BACKLOG_PAGE_SIZE,
  attendanceBacklogPage,
} from "../../src/lib/staff/attendance-backlog-page";

test("approval queue paging reaches older pending shifts", () => {
  assert.deepEqual(
    attendanceBacklogPage("2", ATTENDANCE_BACKLOG_PAGE_SIZE + 1),
    {
      page: 2,
      pageCount: 2,
      skip: ATTENDANCE_BACKLOG_PAGE_SIZE,
    },
  );
  assert.equal(attendanceBacklogPage("999", 26).page, 2);
  assert.equal(attendanceBacklogPage("0", 26).page, 1);
  assert.equal(attendanceBacklogPage("abc", 26).page, 1);
  assert.deepEqual(attendanceBacklogPage("8", 0), {
    page: 1,
    pageCount: 1,
    skip: 0,
  });
});
