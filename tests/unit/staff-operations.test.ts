/* eslint-disable @typescript-eslint/no-explicit-any -- isolated service adapters avoid a live database. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { Prisma } from "@prisma/client";
import * as formulas from "../../src/lib/payroll/payroll-formulas";
import * as sources from "../../src/lib/payroll/payroll-sources";
import * as evidence from "../../src/lib/staff/attendance-evidence";
import * as calendar from "../../src/lib/reports/reporting-calendar";

function operations(tx: Record<string, any>) {
  const dependencies: Record<string, unknown> = {
    "server-only": {},
    "@prisma/client": { Prisma },
    "@/lib/prisma": { prisma: { $transaction: (run: any) => run(tx) } },
    "@/lib/payroll/payroll-formulas": formulas,
    "@/lib/payroll/payroll-sources": sources,
    "./attendance-evidence": evidence,
    "@/lib/reports/reporting-calendar": calendar,
    "@/lib/reports/report-realtime": {
      publishReportInvalidation: async () => {},
    },
  };
  const output = ts.transpileModule(
    readFileSync("src/lib/staff/staff-operations.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const exports: Record<string, any> = {};
  vm.runInNewContext(output, {
    exports,
    Date,
    require(name: string) {
      if (!(name in dependencies))
        throw new Error(`Unmocked dependency: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

const day = (value: string) => new Date(`2026-08-${value}T00:00:00.000Z`);
const at = (time: string) => new Date(`2026-08-10T${time}:00+03:00`);

test("payroll creation uses employment bounds and excludes partially overlapping adjustments", async () => {
  let adjustmentQuery: any;
  const service = operations({
    $executeRaw: async () => {},
    payrollRun: {
      findFirst: async () => null,
      create: async ({ data }: any) => ({
        id: "run",
        ...data,
        lines: data.lines.create,
      }),
    },
    employmentProfile: {
      findMany: async () => [
        {
          userId: "worker",
          compensationType: "DAILY",
          dailyRate: new Prisma.Decimal(20),
          monthlySalary: null,
          effectiveFrom: day("10"),
          effectiveTo: day("20"),
          user: { fullName: "Worker" },
        },
      ],
    },
    attendanceRecord: {
      findMany: async () =>
        ["09", "10", "20", "21"].map((date) => ({
          workerId: "worker",
          businessDate: day(date),
          status: "PRESENT",
          approvedAt: day("31"),
          approvedOvertimeMinutes: 0,
        })),
    },
    payrollAdjustment: {
      findMany: async (query: any) => {
        adjustmentQuery = query;
        return [
          {
            id: "advance",
            workerId: "worker",
            periodStart: day("01"),
            periodEnd: day("31"),
            type: "ADVANCE",
            amount: new Prisma.Decimal(100),
          },
        ];
      },
    },
    auditLog: { create: async () => {} },
  });
  const run = await service.createPayrollRun({
    periodStart: day("01"),
    periodEnd: day("20"),
    actorUserId: "admin",
  });
  assert.equal(run.lines[0].basePay.toFixed(2), "40.00");
  assert.equal(run.lines[0].attendanceDays, 2);
  assert.equal(run.lines[0].deductions.toFixed(2), "0.00");
  assert.equal(
    adjustmentQuery.where.periodStart.gte.toISOString(),
    day("01").toISOString(),
  );
  assert.equal(
    adjustmentQuery.where.periodEnd.lte.toISOString(),
    day("20").toISOString(),
  );
});

function attendanceFixture(
  events: { type: "IN" | "OUT"; occurredAt: Date }[],
  existing: any = null,
) {
  let saved: any = null;
  const service = operations({
    scheduledShift: {
      findUnique: async () => ({
        id: "shift",
        workerId: "worker",
        status: "SCHEDULED",
        startsAt: at("10:00"),
        endsAt: at("18:00"),
      }),
      update: async () => {},
    },
    attendancePolicy: { findUnique: async () => null },
    clockEvent: { findMany: async () => events },
    attendanceRecord: {
      findFirst: async () => existing,
      create: async ({ data }: any) => (saved = { id: "record", ...data }),
      update: async ({ data }: any) => (saved = { ...existing, ...data }),
    },
    auditLog: { create: async () => {} },
  });
  return { service, saved: () => saved };
}

const approval = { shiftId: "shift", status: "PRESENT", actorUserId: "admin" };

test("attendance approval preserves the current shift's evidence and rejects incomplete sessions", async () => {
  const { service } = attendanceFixture([
    { type: "IN", occurredAt: at("05:00") },
    { type: "OUT", occurredAt: at("09:00") },
    { type: "IN", occurredAt: at("10:00") },
    { type: "OUT", occurredAt: at("18:00") },
  ]);
  const record = await service.approveAttendance(approval);
  assert.equal(record.clockInAt.toISOString(), at("10:00").toISOString());
  assert.equal(record.workedMinutes, 480);
  const missingOut = attendanceFixture([
    { type: "IN", occurredAt: at("10:00") },
  ]);
  await assert.rejects(
    missingOut.service.approveAttendance(approval),
    /complete clock session/,
  );
  assert.equal(missingOut.saved(), null);
});

test("approving another shift cannot overwrite approved evidence for the same worker/date", async () => {
  const fixture = attendanceFixture(
    [
      { type: "IN", occurredAt: at("10:00") },
      { type: "OUT", occurredAt: at("18:00") },
    ],
    { id: "prior-record", scheduledShiftId: "prior-shift" },
  );
  await assert.rejects(
    fixture.service.approveAttendance(approval),
    /another shift on this business date/,
  );
  assert.equal(fixture.saved(), null);
});

test("a worker cannot clock out before their first clock-in", async () => {
  let created = false;
  const service = operations({
    clockEvent: {
      findFirst: async () => null,
      create: async () => {
        created = true;
        return { id: "event" };
      },
    },
  });
  await assert.rejects(
    service.recordClockEvent({ workerId: "worker", type: "OUT" }),
    /already clocked out/,
  );
  assert.equal(created, false);
});
