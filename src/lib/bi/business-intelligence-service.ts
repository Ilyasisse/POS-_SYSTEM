import "server-only";

// import { Prisma } from "@prisma/client";
// import { prisma } from "@/lib/prisma";

// async function recordExpense(input: {
//   categoryId: string;
//   amount: Prisma.Decimal.Value;
//   paidAt: Date;
//   actorUserId: string;
//   vendor?: string;
//   paymentMethod?: string;
//   receiptReference?: string;
//   note?: string;
//   isFixed?: boolean;
//   isRecurring?: boolean;
// }) {
//   // Creates an expense transaction with payment details and the user who recorded it. Preserved for future use.
//   return prisma.expenseTransaction.create({
//     data: {
//       categoryId: input.categoryId,
//       amount: new Prisma.Decimal(input.amount),
//       paidAt: input.paidAt,
//       createdByUserId: input.actorUserId,
//       vendor: input.vendor,
//       paymentMethod: input.paymentMethod,
//       receiptReference: input.receiptReference,
//       note: input.note,
//       isFixed: input.isFixed ?? false,
//       isRecurring: input.isRecurring ?? false,
//     },
//   });
// }

// async function approveExpense(expenseId: string, approverUserId: string) {
//   // Marks an expense approved and records the approving user and time. Preserved for future use.
//   return prisma.expenseTransaction.update({
//     where: { id: expenseId },
//     data: {
//       status: "APPROVED",
//       approvedByUserId: approverUserId,
//       approvedAt: new Date(),
//     },
//   });
// }

// async function recordOwnerWithdrawal(input: {
//   amount: Prisma.Decimal.Value;
//   withdrawnAt: Date;
//   reason: string;
//   actorUserId: string;
//   receiptReference?: string;
// }) {
//   // Records an owner withdrawal with its amount, reason, date, and user. Preserved for future use.
//   return prisma.ownerWithdrawal.create({
//     data: {
//       amount: new Prisma.Decimal(input.amount),
//       withdrawnAt: input.withdrawnAt,
//       reason: input.reason,
//       createdByUserId: input.actorUserId,
//       receiptReference: input.receiptReference,
//     },
//   });
// }

// async function receivePurchaseOrder(input: {
//   purchaseOrderId: string;
//   actorUserId: string;
//   qualityRating?: number;
//   rejectionQuantity?: Prisma.Decimal.Value;
//   rejectionReason?: string;
//   completionNote?: string;
//   items: Array<{
//     purchaseOrderItemId: string;
//     expectedQuantity: Prisma.Decimal.Value;
//     receivedQuantity: Prisma.Decimal.Value;
//   }>;
// }) {
//   // Records received purchase-order quantities and optional quality or rejection details. Preserved for future use.
//   if (
//     input.qualityRating != null &&
//     (input.qualityRating < 1 || input.qualityRating > 5)
//   )
//     throw new Error("Quality rating must be from 1 to 5.");
//   return prisma.supplierReceiving.create({
//     data: {
//       purchaseOrderId: input.purchaseOrderId,
//       receivedByUserId: input.actorUserId,
//       qualityRating: input.qualityRating,
//       rejectionQuantity:
//         input.rejectionQuantity == null
//           ? undefined
//           : new Prisma.Decimal(input.rejectionQuantity),
//       rejectionReason: input.rejectionReason,
//       completionNote: input.completionNote,
//       items: {
//         create: input.items.map((item) => ({
//           purchaseOrderItemId: item.purchaseOrderItemId,
//           expectedQuantity: new Prisma.Decimal(item.expectedQuantity),
//           receivedQuantity: new Prisma.Decimal(item.receivedQuantity),
//         })),
//       },
//     },
//   });
// }

// async function recordFeedback(input: {
//   orderId?: string;
//   rating?: number;
//   comment?: string;
//   actorUserId?: string;
// }) {
//   // Validates and records a customer rating or comment for an order. Preserved for future use.
//   if (input.rating != null && (input.rating < 1 || input.rating > 5))
//     throw new Error("Rating must be from 1 to 5.");
//   return prisma.customerFeedback.create({
//     data: {
//       orderId: input.orderId,
//       rating: input.rating,
//       comment: input.comment,
//       createdByUserId: input.actorUserId,
//     },
//   });
// }

// async function resolveComplaint(input: {
//   complaintId: string;
//   resolverUserId: string;
//   resolutionNotes: string;
// }) {
//   // Marks a complaint resolved and records the resolver, notes, and time. Preserved for future use.
//   return prisma.complaintCase.update({
//     where: { id: input.complaintId },
//     data: {
//       status: "RESOLVED",
//       resolutionNotes: input.resolutionNotes,
//       resolvedAt: new Date(),
//       resolvedByUserId: input.resolverUserId,
//     },
//   });
// }
