ALTER TABLE "CafeSetting"
ADD COLUMN "onlineOrderingEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "onlineOrderStartMinute" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "onlineOrderEndMinute" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "CafeSetting"
ADD CONSTRAINT "CafeSetting_online_order_minutes_check"
CHECK (
  "onlineOrderStartMinute" BETWEEN 0 AND 1439
  AND "onlineOrderEndMinute" BETWEEN 0 AND 1439
);
