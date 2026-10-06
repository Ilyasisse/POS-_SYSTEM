"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import {
  assertReservationTransition,
  isReservationStatus,
  parseReservationInput,
} from "@/lib/reservations/reservations";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createReservationAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.TABLE_MANAGE);

  let input;
  try {
    input = parseReservationInput({
      kind: formData.get("kind"),
      guestName: formData.get("guestName"),
      phone: formData.get("phone"),
      partySize: formData.get("partySize"),
      scheduledAt: formData.get("scheduledAt"),
      notes: formData.get("notes"),
    });
  } catch {
    redirect("/admin/reservations?reservationStatus=invalid");
  }

  let reservationStatus = "created";
  try {
    await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.create({
        data: { ...input, createdByUserId: user.id },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "RESERVATION_CREATED",
          entityType: "Reservation",
          entityId: reservation.id,
          newValue: {
            status: reservation.status,
            partySize: reservation.partySize,
            scheduledAt: reservation.scheduledAt?.toISOString() ?? null,
          },
        },
      });
    });
    revalidatePath("/admin/reservations");
  } catch (error) {
    console.error("Failed to create reservation:", error);
    reservationStatus = "failed";
  }

  redirect(`/admin/reservations?reservationStatus=${reservationStatus}`);
}

export async function transitionReservationAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.TABLE_MANAGE);
  const reservationId = text(formData, "reservationId");
  const requestedStatus = text(formData, "nextStatus");
  const tableId = text(formData, "tableId") || null;

  if (!reservationId || !isReservationStatus(requestedStatus)) {
    redirect("/admin/reservations?reservationStatus=invalid_transition");
  }

  let reservationStatus = "updated";
  try {
    await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
        select: { id: true, status: true, tableId: true },
      });
      if (!reservation) throw new Error("Reservation not found.");

      assertReservationTransition(reservation.status, requestedStatus);

      if (requestedStatus === "SEATED") {
        if (!tableId) throw new Error("Choose an available table.");
        const availableTable = await tx.table.findFirst({
          where: {
            id: tableId,
            isActive: true,
            orders: { none: { status: "OPEN" } },
            reservations: {
              none: {
                status: "SEATED",
                id: { not: reservation.id },
              },
            },
          },
          select: { id: true },
        });
        if (!availableTable) throw new Error("The table is not available.");
      }

      const now = new Date();
      const result = await tx.reservation.updateMany({
        where: { id: reservation.id, status: reservation.status },
        data: {
          status: requestedStatus,
          ...(requestedStatus === "SEATED"
            ? { tableId, seatedAt: now }
            : {}),
          ...(["COMPLETED", "CANCELLED", "NO_SHOW"].includes(requestedStatus)
            ? { closedAt: now }
            : {}),
        },
      });
      if (result.count !== 1) {
        throw new Error("Reservation changed while it was being updated.");
      }

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "RESERVATION_STATUS_CHANGED",
          entityType: "Reservation",
          entityId: reservation.id,
          previousValue: {
            status: reservation.status,
            tableId: reservation.tableId,
          },
          newValue: { status: requestedStatus, tableId },
        },
      });
    });
    revalidatePath("/admin/reservations");
  } catch (error) {
    console.error("Failed to update reservation:", error);
    reservationStatus = "transition_failed";
  }

  redirect(`/admin/reservations?reservationStatus=${reservationStatus}`);
}
