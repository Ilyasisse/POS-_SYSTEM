import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function recordExpense(input: { categoryId: string; amount: Prisma.Decimal.Value; paidAt: Date; actorUserId: string; vendor?: string; paymentMethod?: string; receiptReference?: string; note?: string; isFixed?: boolean; isRecurring?: boolean }) {
  return prisma.expenseTransaction.create({ data: { categoryId: input.categoryId, amount: new Prisma.Decimal(input.amount), paidAt: input.paidAt, createdByUserId: input.actorUserId, vendor: input.vendor, paymentMethod: input.paymentMethod, receiptReference: input.receiptReference, note: input.note, isFixed: input.isFixed ?? false, isRecurring: input.isRecurring ?? false } });
}

export async function approveExpense(expenseId: string, approverUserId: string) {
  return prisma.expenseTransaction.update({ where: { id: expenseId }, data: { status: "APPROVED", approvedByUserId: approverUserId, approvedAt: new Date() } });
}

export async function recordOwnerWithdrawal(input: { amount: Prisma.Decimal.Value; withdrawnAt: Date; reason: string; actorUserId: string; receiptReference?: string }) {
  return prisma.ownerWithdrawal.create({ data: { amount: new Prisma.Decimal(input.amount), withdrawnAt: input.withdrawnAt, reason: input.reason, createdByUserId: input.actorUserId, receiptReference: input.receiptReference } });
}

export async function receivePurchaseOrder(input: { purchaseOrderId: string; actorUserId: string; qualityRating?: number; rejectionQuantity?: Prisma.Decimal.Value; rejectionReason?: string; completionNote?: string; items: Array<{ purchaseOrderItemId: string; expectedQuantity: Prisma.Decimal.Value; receivedQuantity: Prisma.Decimal.Value }> }) {
  if (input.qualityRating != null && (input.qualityRating < 1 || input.qualityRating > 5)) throw new Error("Quality rating must be from 1 to 5.");
  return prisma.supplierReceiving.create({ data: { purchaseOrderId: input.purchaseOrderId, receivedByUserId: input.actorUserId, qualityRating: input.qualityRating, rejectionQuantity: input.rejectionQuantity == null ? undefined : new Prisma.Decimal(input.rejectionQuantity), rejectionReason: input.rejectionReason, completionNote: input.completionNote, items: { create: input.items.map((item) => ({ purchaseOrderItemId: item.purchaseOrderItemId, expectedQuantity: new Prisma.Decimal(item.expectedQuantity), receivedQuantity: new Prisma.Decimal(item.receivedQuantity) })) } } });
}

export async function recordFeedback(input: { orderId?: string; rating?: number; comment?: string; actorUserId?: string }) {
  if (input.rating != null && (input.rating < 1 || input.rating > 5)) throw new Error("Rating must be from 1 to 5.");
  return prisma.customerFeedback.create({ data: { orderId: input.orderId, rating: input.rating, comment: input.comment, createdByUserId: input.actorUserId } });
}

export async function resolveComplaint(input: { complaintId: string; resolverUserId: string; resolutionNotes: string }) {
  return prisma.complaintCase.update({ where: { id: input.complaintId }, data: { status: "RESOLVED", resolutionNotes: input.resolutionNotes, resolvedAt: new Date(), resolvedByUserId: input.resolverUserId } });
}
