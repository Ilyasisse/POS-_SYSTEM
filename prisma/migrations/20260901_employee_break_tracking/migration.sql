ALTER TYPE "ClockEventType" ADD VALUE IF NOT EXISTS 'BREAK_START' AFTER 'IN';
ALTER TYPE "ClockEventType" ADD VALUE IF NOT EXISTS 'BREAK_END' AFTER 'BREAK_START';

ALTER TABLE "AttendanceRecord"
ADD COLUMN "breakMinutes" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "AttendanceRecord"
ADD CONSTRAINT "AttendanceRecord_breakMinutes_check"
CHECK ("breakMinutes" >= 0);
