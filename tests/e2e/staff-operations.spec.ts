import { expect } from "@playwright/test";
import { db, unique, user } from "../workflow/fixtures";
import { session, test } from "../workflow/browser";
import { formatBusinessDate } from "../../src/lib/reports/reporting-calendar";

test.afterAll(() => db.$disconnect());

test("staff clocks in and out, then admin approves attendance and finalizes payroll", async ({
  browser,
}) => {
  const [worker, admin] = await Promise.all([user("MANAGER"), user("ADMIN")]);
  const dateKey = formatBusinessDate(new Date());
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  await db.employmentProfile.create({
    data: { userId: worker.id, compensationType: "DAILY", dailyRate: 20, effectiveFrom: date },
  });
  const shift = await db.scheduledShift.create({
    data: {
      workerId: worker.id,
      startsAt: new Date(date.getTime() + 4 * 3_600_000),
      endsAt: new Date(date.getTime() + 25 * 3_600_000),
      createdByUserId: admin.id,
    },
  });
  const contexts = await Promise.all([session(browser, worker), session(browser, admin)]);
  try {
    const [attendance, management] = await Promise.all(
      contexts.map((context) => context.newPage()),
    );
    await attendance.goto("/staff/attendance");
    await attendance.getByRole("button", { name: "Clock in", exact: true }).click();
    await attendance.getByRole("button", { name: "Clock out", exact: true }).click();
    await expect(attendance.getByRole("button", { name: "Clock in", exact: true })).toBeVisible();
    expect(await db.clockEvent.count({ where: { workerId: worker.id } })).toBe(2);
    await management.goto("/admin/staff/attendance");
    const approval = management
      .locator("form")
      .filter({ has: management.locator(`input[name=shiftId][value="${shift.id}"]`) });
    await approval.locator("select[name=status]").selectOption("PRESENT");
    await approval.getByRole("button", { name: "Approve", exact: true }).click();
    await expect
      .poll(() => db.attendanceRecord.count({ where: { workerId: worker.id, status: "PRESENT" } }))
      .toBe(1);
    await management.goto("/admin/staff/payroll");
    const preview = management
      .locator("form")
      .filter({ has: management.getByRole("button", { name: "Create draft run" }) });
    await preview.locator("input[name=periodStart]").fill(dateKey);
    await preview.locator("input[name=periodEnd]").fill(dateKey);
    await preview.getByRole("button", { name: "Create draft run" }).click();
    const runFilter = { createdByUserId: admin.id };
    await expect.poll(() => db.payrollRun.count({ where: runFilter })).toBe(1);
    const run = await db.payrollRun.findFirstOrThrow({ where: runFilter });
    const runForms = management
      .locator("form")
      .filter({ has: management.locator(`input[name=runId][value="${run.id}"]`) });
    await runForms.getByRole("button", { name: "Approve", exact: true }).click();
    await runForms.getByRole("button", { name: "Finalize", exact: true }).click();
    await expect
      .poll(async () => (await db.payrollRun.findUniqueOrThrow({ where: { id: run.id } })).status)
      .toBe("FINALIZED");
    const line = await db.payrollLine.findFirstOrThrow({
      where: { payrollRunId: run.id, workerId: worker.id },
    });
    expect(Number(line.netPay)).toBe(20);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test("admin completes a cleaning run and the open run stays gone after reload", async ({
  browser,
}) => {
  const admin = await user("ADMIN");
  const template = await db.cleaningChecklistTemplate.create({
    data: {
      name: unique("Test cleaning"),
      schedule: "Daily",
      tasks: { create: { label: unique("Wipe counter"), isRequired: true } },
    },
    include: { tasks: true },
  });
  const run = await db.cleaningChecklistRun.create({
    data: {
      templateId: template.id,
      scheduledFor: new Date(),
      tasks: { create: { taskId: template.tasks[0].id } },
    },
    include: { tasks: true },
  });
  const context = await session(browser, admin);
  try {
    const page = await context.newPage();
    await page.goto("/admin/operations");
    const task = page
      .locator("form")
      .filter({ has: page.locator(`input[name=runTaskId][value="${run.tasks[0].id}"]`) });
    await task.getByRole("button", { name: "Done", exact: true }).click();
    await expect(task.getByRole("button", { name: "Done", exact: true })).toHaveCount(0);
    const finish = page
      .locator("form")
      .filter({ has: page.locator(`input[name=runId][value="${run.id}"]`) });
    await finish.getByPlaceholder("Completion evidence note").fill("Synthetic cleaning evidence");
    await finish.getByRole("button", { name: "Complete run" }).click();
    await expect
      .poll(
        async () =>
          (await db.cleaningChecklistRun.findUniqueOrThrow({ where: { id: run.id } })).status,
      )
      .toBe("COMPLETED");
    await page.reload();
    await expect(finish).toHaveCount(0);
  } finally {
    await context.close();
  }
});
