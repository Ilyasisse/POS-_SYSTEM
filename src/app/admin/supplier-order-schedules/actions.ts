"use server";

import type { SupplierOrderRecurrenceUnit } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import {
  isValidTimeZone,
  normalizeE164Phone,
  zonedDateTimeToUtc,
} from "@/lib/supplier-orders/scheduling";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function integer(formData: FormData, key: string) {
  return Number.parseInt(text(formData, key), 10);
}

async function scheduleInput(formData: FormData) {
  const name = text(formData, "name");
  const supplierId = text(formData, "supplierId");
  const timeZone = text(formData, "timeZone") || "Africa/Nairobi";
  const firstInviteAt = zonedDateTimeToUtc(text(formData, "firstInviteAt"), timeZone);
  const firstSupplierSendAt = zonedDateTimeToUtc(
    text(formData, "firstSupplierSendAt"),
    timeZone,
  );
  const endValue = text(formData, "endAt");
  const endAt = endValue ? zonedDateTimeToUtc(endValue, timeZone) : null;
  const reminderIntervalMinutes = integer(formData, "reminderIntervalMinutes");
  const recurrenceValue = text(formData, "recurrenceUnit");
  const recurrenceUnit = ["DAY", "WEEK", "MONTH"].includes(recurrenceValue)
    ? (recurrenceValue as SupplierOrderRecurrenceUnit)
    : null;
  const recurrenceInterval = recurrenceUnit
    ? integer(formData, "recurrenceInterval")
    : 1;
  const deliveryLeadDays = integer(formData, "deliveryLeadDays");
  const employeeIds = [...new Set(formData.getAll("employeeId").map(String))];

  if (name.length < 2 || name.length > 120) throw new Error("Enter a schedule name between 2 and 120 characters.");
  if (!isValidTimeZone(timeZone)) throw new Error("Enter a valid IANA timezone.");
  if (!firstInviteAt || !firstSupplierSendAt || firstSupplierSendAt <= firstInviteAt) {
    throw new Error("Supplier send time must be after the employee invitation time.");
  }
  if (firstInviteAt.getTime() < Date.now() - 60_000) {
    throw new Error("The first invitation time cannot be in the past.");
  }
  if (endAt && endAt < firstInviteAt) throw new Error("The end time cannot be before the first invitation.");
  if (!Number.isInteger(reminderIntervalMinutes) || reminderIntervalMinutes < 5 || reminderIntervalMinutes > 10080) {
    throw new Error("Reminder interval must be between 5 and 10,080 minutes.");
  }
  if (!Number.isInteger(recurrenceInterval) || recurrenceInterval < 1 || recurrenceInterval > 365) {
    throw new Error("Recurrence interval must be between 1 and 365.");
  }
  if (!Number.isInteger(deliveryLeadDays) || deliveryLeadDays < 0 || deliveryLeadDays > 365) {
    throw new Error("Delivery lead days must be between 0 and 365.");
  }
  if (employeeIds.length === 0) throw new Error("Choose at least one employee.");

  const [supplier, employees] = await Promise.all([
    prisma.supplier.findFirst({
      where: { id: supplierId, isActive: true },
      select: {
        id: true,
        phone: true,
        _count: { select: { catalogItems: { where: { isActive: true } } } },
      },
    }),
    prisma.user.findMany({
      where: { id: { in: employeeIds }, isActive: true },
      select: { id: true, phoneNumber: true },
    }),
  ]);
  if (!supplier || !supplier.phone || !normalizeE164Phone(supplier.phone)) {
    throw new Error("Choose an active supplier with a valid E.164 phone number.");
  }
  if (supplier._count.catalogItems === 0) throw new Error("The supplier needs at least one active catalog item.");
  if (
    employees.length !== employeeIds.length ||
    employees.some((employee) => !employee.phoneNumber || !normalizeE164Phone(employee.phoneNumber))
  ) {
    throw new Error("Every selected employee must be active and have a valid E.164 phone number.");
  }
  return {
    data: {
      name,
      supplierId: supplier.id,
      timeZone,
      firstInviteAt,
      firstSupplierSendAt,
      nextInviteAt: firstInviteAt,
      nextSupplierSendAt: firstSupplierSendAt,
      reminderIntervalMinutes,
      recurrenceUnit,
      recurrenceInterval,
      endAt,
      deliveryLeadDays,
      isActive: true,
    },
    employeeIds,
  };
}

export async function createSupplierOrderSchedule(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const input = await scheduleInput(formData);
  const schedule = await prisma.supplierOrderSchedule.create({
    data: {
      ...input.data,
      createdByUserId: user.id,
      recipients: {
        create: input.employeeIds.map((userId) => ({ userId })),
      },
    },
    select: { id: true },
  });
  revalidatePath("/admin/supplier-order-schedules");
  redirect(`/admin/supplier-order-schedules/${schedule.id}?status=created`);
}

export async function updateSupplierOrderSchedule(formData: FormData) {
  await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const id = text(formData, "id");
  const input = await scheduleInput(formData);
  await prisma.$transaction(async (tx) => {
    await tx.supplierOrderSchedule.update({ where: { id }, data: input.data });
    await tx.supplierOrderScheduleRecipient.deleteMany({ where: { scheduleId: id } });
    await tx.supplierOrderScheduleRecipient.createMany({
      data: input.employeeIds.map((userId) => ({ scheduleId: id, userId })),
    });
  });
  revalidatePath("/admin/supplier-order-schedules");
  revalidatePath(`/admin/supplier-order-schedules/${id}`);
  redirect(`/admin/supplier-order-schedules/${id}?status=updated`);
}

export async function toggleSupplierOrderSchedule(formData: FormData) {
  await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const id = text(formData, "id");
  const schedule = await prisma.supplierOrderSchedule.findUnique({
    where: { id },
    select: { isActive: true, nextInviteAt: true },
  });
  if (!schedule) throw new Error("Schedule not found.");
  if (!schedule.isActive && !schedule.nextInviteAt) {
    throw new Error("This completed one-time schedule cannot be resumed; edit it with new dates instead.");
  }
  await prisma.supplierOrderSchedule.update({
    where: { id },
    data: { isActive: !schedule.isActive },
  });
  revalidatePath("/admin/supplier-order-schedules");
  revalidatePath(`/admin/supplier-order-schedules/${id}`);
}

export async function retrySupplierOrderRun(formData: FormData) {
  await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const runId = text(formData, "runId");
  const run = await prisma.supplierOrderRun.findFirst({
    where: { id: runId, status: "FAILED" },
    select: { id: true, scheduleId: true, purchaseOrderId: true },
  });
  if (!run) throw new Error("Only a failed run can be retried.");
  await prisma.$transaction([
    prisma.supplierOrderRun.update({
      where: { id: run.id },
      data: {
        status: run.purchaseOrderId ? "FINALIZING" : "COLLECTING",
        failureReason: null,
      },
    }),
    prisma.supplierOrderWhatsAppDelivery.updateMany({
      where: { runId: run.id, status: "FAILED" },
      data: { status: "PENDING", attempts: 0, lastAttemptAt: null, failedAt: null, errorMessage: null },
    }),
  ]);
  revalidatePath(`/admin/supplier-order-schedules/${run.scheduleId}`);
}
