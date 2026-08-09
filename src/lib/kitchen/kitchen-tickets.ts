import "server-only";

import {
  KitchenPickupStatus,
  KitchenStationTicketStatus,
  Prisma,
  Station,
  type UserRole,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  filterKitchenTicketByStation,
  getKitchenTicketStatusForItems,
  normalizeKitchenStation,
  type KitchenStation,
  type KitchenTicket,
  type KitchenTicketStatus,
} from "@/lib/kitchen/kitchen-socket";
import {
  getEffectiveStation,
  type PermissionUser,
} from "@/lib/auth/permissions";
import { calculateKitchenPreparationMetric } from "@/lib/kitchen/kitchen-metrics";

type KitchenStateTransaction = Prisma.TransactionClient;

type KitchenStateLine = {
  station: Station | null;
};

export class KitchenTicketMutationError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 403 | 404 | 409,
  ) {
    super(message);
    this.name = "KitchenTicketMutationError";
  }
}

function toTicketStatus(status: KitchenStationTicketStatus): KitchenTicketStatus {
  if (status === "IN_PROGRESS") return "in_progress";
  if (status === "DONE") return "done";
  return "new";
}

function toPickupStatus(status: KitchenPickupStatus): KitchenTicket["pickupStatus"] {
  if (status === "READY") return "ready";
  if (status === "CLAIMED") return "claimed";
  if (status === "DELIVERED") return "delivered";
  return "preparing";
}

function toDatabaseStatus(status: KitchenTicketStatus): KitchenStationTicketStatus {
  if (status === "in_progress") return "IN_PROGRESS";
  if (status === "done") return "DONE";
  return "NEW";
}

function getStationSet(lines: readonly KitchenStateLine[]) {
  return [...new Set(lines.map((line) => line.station).filter((station): station is Station => Boolean(station)))];
}

/** Creates the durable ticket state in the same transaction as its order. */
export async function createKitchenTicketState(
  tx: KitchenStateTransaction,
  input: {
    orderId: string;
    lines: readonly KitchenStateLine[];
    customerName?: string | null;
    actorUserId?: string | null;
  },
) {
  const stations = getStationSet(input.lines);

  if (stations.length === 0) return null;

  const targets = await tx.kitchenPreparationTarget.findMany({
    where: { station: { in: stations } },
  });
  const targetByStation = new Map(
    targets.map((target) => [target.station, target.targetMinutes]),
  );

  return tx.kitchenTicketState.create({
    data: {
      orderId: input.orderId,
      customerName: input.customerName?.trim() || null,
      stationStates: {
        create: stations.map((station) => ({ station })),
      },
      transitions: {
        create: stations.map((station) => ({
          station,
          type: "STATION_CREATED",
          toStationStatus: "NEW",
          targetMinutesSnapshot: targetByStation.get(station) ?? null,
          actorUserId: input.actorUserId ?? null,
        })),
      },
    },
  });
}

type KitchenStateRecord = Prisma.KitchenTicketStateGetPayload<{
  include: {
    stationStates: true;
    transitions: true;
    order: {
      include: {
        table: true;
        cashier: true;
        waiter: true;
        orderItems: {
          include: {
            assignedUser: true;
            modifiers: true;
          };
        };
      };
    };
  };
}>;

function mapKitchenTicket(state: KitchenStateRecord): KitchenTicket {
  const items = state.order.orderItems
    .filter((item): item is typeof item & { station: Station } => item.station !== null)
    .map((item) => ({
      id: item.id,
      name: item.productName,
      quantity: item.qty,
      station: item.station as KitchenStation,
      assignedUserId: item.assignedUserId,
      assignedUserName: item.assignedUser?.fullName ?? null,
      modifiers: item.modifiers.map((modifier) => ({
        id: modifier.id,
        name: modifier.modifierName,
        qty: modifier.qty,
        price: Number(modifier.price),
      })),
    }));
  const stationStatuses = Object.fromEntries(
    state.stationStates.map((stationState) => [
      stationState.station as KitchenStation,
      toTicketStatus(stationState.status),
    ]),
  );
  const transitionsByStation = state.transitions.reduce<
    Partial<Record<KitchenStation, Array<{
      type: "STATION_CREATED" | "STATION_STARTED" | "STATION_COMPLETED" | "STATION_REOPENED";
      occurredAt: Date;
      targetMinutesSnapshot: number | null;
    }>>>
  >((grouped, event) => {
    if (!event.station) return grouped;
    const station = event.station as KitchenStation;
    const events = grouped[station] ?? [];
    events.push({
      type: event.type as "STATION_CREATED" | "STATION_STARTED" | "STATION_COMPLETED" | "STATION_REOPENED",
      occurredAt: event.occurredAt,
      targetMinutesSnapshot: event.targetMinutesSnapshot,
    });
    grouped[station] = events;
    return grouped;
  }, {});
  const ticket = {
    id: state.orderId,
    orderId: state.orderId,
    orderNumber: state.order.orderNumber,
    createdAt: state.order.createdAt.toISOString(),
    status: "new" as KitchenTicketStatus,
    stationStatuses,
    stationMetrics: Object.fromEntries(
      state.stationStates.map((stationState) => [
        stationState.station as KitchenStation,
        (() => {
          const metric = calculateKitchenPreparationMetric(
            transitionsByStation[stationState.station as KitchenStation] ?? [],
          );
          return {
            ...metric,
            startedAt: metric.startedAt?.toISOString() ?? null,
            completedAt: metric.completedAt?.toISOString() ?? null,
          };
        })(),
      ]),
    ),
    pickupStatus: toPickupStatus(state.pickupStatus),
    tableId: state.order.tableId,
    tableName: state.order.table?.name ?? null,
    cashierId: state.order.cashierId,
    cashierName: state.order.cashier?.fullName ?? null,
    claimedByWaiterId: state.claimedByWaiterId,
    claimedByWaiterName: state.claimedByWaiterName,
    note: state.order.notes,
    waiterId: state.order.waiterId,
    waiterName: state.order.waiter?.fullName ?? state.customerName ?? null,
    items,
  } satisfies KitchenTicket;

  return {
    ...ticket,
    status: getKitchenTicketStatusForItems(ticket),
  };
}

function getViewerFilter(viewer: PermissionUser, requestedStation?: string | null) {
  if (viewer.role === "ADMIN") {
    return {
      station: normalizeKitchenStation(requestedStation),
      userId: viewer.id,
      role: viewer.role,
    };
  }

  if (viewer.role === "WAITER") {
    return { station: null, userId: viewer.id, role: viewer.role };
  }

  return {
    station: getEffectiveStation(viewer),
    userId: viewer.id,
    role: viewer.role,
  };
}

export async function getKitchenTicketSnapshot(
  viewer: PermissionUser,
  requestedStation?: string | null,
) {
  const filter = getViewerFilter(viewer, requestedStation);

  if (viewer.role !== "ADMIN" && viewer.role !== "WAITER" && !filter.station) {
    return [];
  }

  const states = await prisma.kitchenTicketState.findMany({
    where: { pickupStatus: { not: "DELIVERED" } },
    orderBy: { updatedAt: "desc" },
    include: {
      stationStates: true,
      transitions: true,
      order: {
        include: {
          table: true,
          cashier: true,
          waiter: true,
          orderItems: {
            include: {
              assignedUser: true,
              modifiers: true,
            },
          },
        },
      },
    },
  });

  return states
    .map(mapKitchenTicket)
    .map((ticket) => filterKitchenTicketByStation(ticket, filter))
    .filter((ticket): ticket is KitchenTicket => ticket !== null);
}

async function lockTicket(tx: KitchenStateTransaction, orderId: string) {
  const locked = await tx.$queryRaw<Array<{ orderId: string }>>(
    Prisma.sql`SELECT "orderId" AS "orderId" FROM "KitchenTicketState" WHERE "orderId" = ${orderId} FOR UPDATE`,
  );

  if (locked.length === 0) {
    throw new KitchenTicketMutationError("Kitchen ticket not found.", 404);
  }

  return tx.kitchenTicketState.findUniqueOrThrow({
    where: { orderId },
    include: { stationStates: true },
  });
}

export async function updateKitchenTicketStation(
  input: {
    orderId: string;
    station: KitchenStation;
    status: KitchenTicketStatus;
    actorUserId: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const state = await lockTicket(tx, input.orderId);
    const station = input.station as Station;

    if (!state.stationStates.some((item) => item.station === station)) {
      throw new KitchenTicketMutationError("Kitchen station ticket not found.", 404);
    }

    const previous = state.stationStates.find((item) => item.station === station)!;
    const nextStatus = toDatabaseStatus(input.status);
    if (previous.status === nextStatus) return;
    const target = await tx.kitchenPreparationTarget.findUnique({
      where: { station },
    });

    await tx.kitchenTicketStationState.update({
      where: { orderId_station: { orderId: input.orderId, station } },
      data: { status: nextStatus },
    });

    await tx.kitchenTransitionEvent.create({
      data: {
        orderId: input.orderId,
        station,
        type:
          nextStatus === "IN_PROGRESS"
            ? "STATION_STARTED"
            : nextStatus === "DONE"
              ? "STATION_COMPLETED"
              : "STATION_REOPENED",
        fromStationStatus: previous.status,
        toStationStatus: nextStatus,
        targetMinutesSnapshot: target?.targetMinutes ?? null,
        actorUserId: input.actorUserId,
      },
    });

    const stationStates = state.stationStates.map((item) =>
      item.station === station ? { ...item, status: nextStatus } : item,
    );
    const allDone = stationStates.every((item) => item.status === "DONE");
    const nextPickupStatus = allDone
      ? state.pickupStatus === "PREPARING"
        ? "READY"
        : state.pickupStatus
      : state.pickupStatus === "READY"
        ? "PREPARING"
        : state.pickupStatus;

    await tx.kitchenTicketState.update({
      where: { orderId: input.orderId },
      data: { pickupStatus: nextPickupStatus },
    });
    if (nextPickupStatus === "READY" && state.pickupStatus !== "READY") {
      await tx.kitchenTransitionEvent.create({
        data: {
          orderId: input.orderId,
          type: "PICKUP_READY",
          fromPickupStatus: state.pickupStatus,
          toPickupStatus: "READY",
          actorUserId: input.actorUserId,
        },
      });
    } else if (nextPickupStatus === "PREPARING" && state.pickupStatus === "READY") {
      await tx.kitchenTransitionEvent.create({
        data: {
          orderId: input.orderId,
          type: "PICKUP_REOPENED",
          fromPickupStatus: "READY",
          toPickupStatus: "PREPARING",
          actorUserId: input.actorUserId,
        },
      });
    }
  });
}

export async function updateKitchenTicketPickup(
  input: {
    orderId: string;
    pickupStatus: "claimed" | "delivered";
    viewer: { id: string; fullName: string; role: UserRole };
  },
) {
  return prisma.$transaction(async (tx) => {
    const state = await lockTicket(tx, input.orderId);

    if (input.pickupStatus === "claimed") {
      if (state.pickupStatus === "CLAIMED" && state.claimedByWaiterId === input.viewer.id) {
        return;
      }
      if (state.pickupStatus === "CLAIMED") {
        throw new KitchenTicketMutationError("This ticket is claimed by another waiter.", 409);
      }
      if (state.pickupStatus !== "READY") {
        throw new KitchenTicketMutationError("Only ready tickets can be claimed.", 409);
      }

      await tx.kitchenTicketState.update({
        where: { orderId: input.orderId },
        data: {
          pickupStatus: "CLAIMED",
          claimedByWaiterId: input.viewer.id,
          claimedByWaiterName: input.viewer.fullName,
        },
      });
      await tx.kitchenTransitionEvent.create({
        data: {
          orderId: input.orderId,
          type: "PICKUP_CLAIMED",
          fromPickupStatus: state.pickupStatus,
          toPickupStatus: "CLAIMED",
          actorUserId: input.viewer.id,
        },
      });
      return;
    }

    const canDeliver =
      state.pickupStatus === "READY" ||
      (state.pickupStatus === "CLAIMED" &&
        (state.claimedByWaiterId === input.viewer.id || input.viewer.role === "ADMIN"));

    if (!canDeliver) {
      throw new KitchenTicketMutationError("You cannot deliver this ticket.", 409);
    }

    await tx.kitchenTicketState.update({
      where: { orderId: input.orderId },
      data: { pickupStatus: "DELIVERED" },
    });
    await tx.kitchenTransitionEvent.create({
      data: {
        orderId: input.orderId,
        type: "PICKUP_DELIVERED",
        fromPickupStatus: state.pickupStatus,
        toPickupStatus: "DELIVERED",
        actorUserId: input.viewer.id,
      },
    });
  });
}
