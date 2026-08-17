import { randomUUID } from "node:crypto";

export const SUPPLIER_ORDER_SCHEDULER_LEASE_KEY =
  "supplier-order-scheduler";
export const SUPPLIER_ORDER_SCHEDULER_LEASE_DURATION_MS = 180_000;

export type SchedulerLeaseClaim = {
  key: string;
  ownerToken: string;
  leaseDurationMs: number;
};

export type SchedulerLeaseRelease = Pick<
  SchedulerLeaseClaim,
  "key" | "ownerToken"
>;

export type SchedulerLeaseOperations = {
  tryAcquire(claim: SchedulerLeaseClaim): Promise<boolean>;
  release(claim: SchedulerLeaseRelease): Promise<void>;
};

type ExecuteWithSchedulerLeaseOptions<T> = {
  lease: SchedulerLeaseOperations;
  process: () => Promise<T>;
  createOwnerToken?: () => string;
};

export type SchedulerLeaseExecution<T> =
  | { alreadyRunning: true }
  | { alreadyRunning: false; result: T };

export async function executeWithSupplierOrderSchedulerLease<T>({
  lease,
  process,
  createOwnerToken = randomUUID,
}: ExecuteWithSchedulerLeaseOptions<T>): Promise<SchedulerLeaseExecution<T>> {
  const ownerToken = createOwnerToken();
  const claim = {
    key: SUPPLIER_ORDER_SCHEDULER_LEASE_KEY,
    ownerToken,
    leaseDurationMs: SUPPLIER_ORDER_SCHEDULER_LEASE_DURATION_MS,
  };
  const acquired = await lease.tryAcquire(claim);
  if (!acquired) return { alreadyRunning: true };

  try {
    return { alreadyRunning: false, result: await process() };
  } finally {
    await lease.release({ key: claim.key, ownerToken });
  }
}
