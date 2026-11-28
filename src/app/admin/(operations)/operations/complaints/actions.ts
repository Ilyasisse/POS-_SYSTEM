"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import {
  assignComplaint,
  createComplaint,
  resolveComplaintCase,
} from "@/lib/customer/complaint-service";
import { prisma } from "@/lib/prisma";

const path = "/admin/operations/complaints";
const field = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();

export async function createComplaintAction(form: FormData) {
  const user = await requirePermission(PERMISSIONS.COMPLAINT_MANAGE);
  const orderNumber = field(form, "orderNumber");
  let orderId = "";
  if (orderNumber) {
    if (!/^\d{1,10}$/.test(orderNumber) || Number(orderNumber) > 2_147_483_647)
      throw new Error("Enter a valid order number.");
    const order = await prisma.order.findUnique({
      where: { orderNumber: Number(orderNumber) },
      select: { id: true },
    });
    if (!order) throw new Error("Order number not found.");
    orderId = order.id;
  }
  await createComplaint(
    {
      category: field(form, "category"),
      priority: field(form, "priority"),
      description: field(form, "description"),
      orderId,
    },
    user.id,
  );
  revalidatePath(path);
  redirect(`${path}?notice=created`);
}

export async function assignComplaintAction(form: FormData) {
  const user = await requirePermission(PERMISSIONS.COMPLAINT_MANAGE);
  await assignComplaint(
    {
      complaintId: field(form, "complaintId"),
      assigneeId: field(form, "assigneeId"),
    },
    user.id,
  );
  revalidatePath(path);
  redirect(`${path}?notice=assigned`);
}

export async function resolveComplaintAction(form: FormData) {
  const user = await requirePermission(PERMISSIONS.COMPLAINT_MANAGE);
  await resolveComplaintCase(
    {
      complaintId: field(form, "complaintId"),
      resolutionNotes: field(form, "resolutionNotes"),
    },
    user.id,
  );
  revalidatePath(path);
  redirect(`${path}?notice=resolved`);
}
