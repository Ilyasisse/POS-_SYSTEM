import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { processScheduledSupplierOrders } from "./service";
import {
  executeWithSupplierOrderSchedulerLease,
  type SchedulerLeaseOperations,
} from "./scheduler-lease";
import { isWhatsAppEnabled } from "./whatsapp";

const prismaSchedulerLease: SchedulerLeaseOperations = {
  async tryAcquire({ key, ownerToken, leaseDurationMs }) {
    const leaseDurationSeconds = Math.ceil(leaseDurationMs / 1000);
    const rows = await prisma.$queryRaw<Array<{ ownerToken: string }>>(
      Prisma.sql`
        INSERT INTO "SchedulerLease" (
          "key",
          "ownerToken",
          "expiresAt",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${key},
          ${ownerToken},
          CURRENT_TIMESTAMP + (${leaseDurationSeconds} * INTERVAL '1 second'),
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT ("key") DO UPDATE
        SET
          "ownerToken" = EXCLUDED."ownerToken",
          "expiresAt" = EXCLUDED."expiresAt",
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "SchedulerLease"."expiresAt" <= CURRENT_TIMESTAMP
        RETURNING "ownerToken"
      `,
    );
    return rows[0]?.ownerToken === ownerToken;
  },

  async release({ key, ownerToken }) {
    await prisma.schedulerLease.deleteMany({
      where: { key, ownerToken },
    });
  },
};

// This lease prevents concurrent sends. It cannot provide absolute exactly-once
// delivery if Twilio accepts a message immediately before the process exits.
export async function runSupplierOrderScheduler() {
  const execution = await executeWithSupplierOrderSchedulerLease({
    lease: prismaSchedulerLease,
    process: processScheduledSupplierOrders,
  });
  if (execution.alreadyRunning) {
    return {
      enabled: isWhatsAppEnabled(),
      alreadyRunning: true as const,
    };
  }
  return {
    ...execution.result,
    alreadyRunning: false as const,
  };
}
