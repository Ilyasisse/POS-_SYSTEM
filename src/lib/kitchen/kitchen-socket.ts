export const KITCHEN_STATIONS = [
  "CUNTO_SOOMAALI",
  "FAST_FOOD",
  "CABITAAN",
  "BARISTA",
] as const;

export type KitchenStation = (typeof KITCHEN_STATIONS)[number];

export type KitchenTicketStatus = "new" | "in_progress" | "done";
export type KitchenTicketPickupStatus = "preparing" | "ready" | "claimed" | "delivered";
export type KitchenTicketStationStatuses = Partial<
  Record<KitchenStation, KitchenTicketStatus>
>;

export type KitchenViewerRole = "ADMIN" | "BARISTA" | "COOK" | string;

export type KitchenTicketModifier = {
  id: string;
  name: string;
  qty: number;
  price: number;
};

export type KitchenTicketItem = {
  id: string;
  name: string;
  quantity: number;
  station: KitchenStation;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  modifiers: KitchenTicketModifier[];
};

export type KitchenTicket = {
  id: string;
  orderId: string;
  orderNumber: number;
  createdAt: string;
  status: KitchenTicketStatus;
  stationStatuses: KitchenTicketStationStatuses;
  pickupStatus: KitchenTicketPickupStatus;
  tableId?: string | null;
  tableName?: string | null;
  cashierId?: string | null;
  cashierName?: string | null;
  claimedByWaiterId?: string | null;
  claimedByWaiterName?: string | null;
  note?: string | null;
  waiterId?: string | null;
  waiterName?: string | null;
  items: KitchenTicketItem[];
};

export type KitchenSocketMessage =
  | {
      type: "ORDER_SNAPSHOT";
      payload: KitchenTicket[];
    }
  | {
      type: "NEW_ORDER";
      payload: KitchenTicket;
    }
  | {
      type: "UPDATE_ORDER_STATUS";
      payload: {
        id: string;
        station: KitchenStation;
        status: KitchenTicketStatus;
      };
    }
  | {
      type: "UPDATE_PICKUP_STATUS";
      payload: {
        id: string;
        pickupStatus: KitchenTicketPickupStatus;
        claimedByWaiterId?: string | null;
        claimedByWaiterName?: string | null;
      };
    };

type KitchenTicketModifierLike = Partial<KitchenTicketModifier>;

type KitchenTicketLike = Partial<KitchenTicket> & {
  receiptNo?: number;
  stationStatuses?: Partial<Record<string, KitchenTicketStatus>>;
  items?: Array<
    Partial<KitchenTicketItem> & {
      station?: string | null;
      modifiers?: KitchenTicketModifierLike[] | null;
    }
  >;
};

export type KitchenTicketFilter = {
  station?: string | null;
  userId?: string | null;
  role?: KitchenViewerRole | null;
};

function resolveFilter(
  stationOrFilter?: string | KitchenTicketFilter | null,
  userId?: string | null,
  role?: KitchenViewerRole | null,
): KitchenTicketFilter {
  if (
    stationOrFilter &&
    typeof stationOrFilter === "object" &&
    !Array.isArray(stationOrFilter)
  ) {
    return {
      station: stationOrFilter.station ?? null,
      userId: stationOrFilter.userId ?? null,
      role: stationOrFilter.role ?? null,
    };
  }

  const station =
    typeof stationOrFilter === "string" ? stationOrFilter : null;

  return {
    station,
    userId: userId ?? null,
    role: role ?? null,
  };
}

function normalizeTicketModifier(
  modifier: KitchenTicketModifierLike | null | undefined,
): KitchenTicketModifier | null {
  if (!modifier?.id || !modifier?.name) {
    return null;
  }

  return {
    id: String(modifier.id),
    name: String(modifier.name),
    qty: Math.max(1, Number(modifier.qty) || 1),
    price: Number(modifier.price) || 0,
  };
}

function isKitchenTicketStatus(value: unknown): value is KitchenTicketStatus {
  return value === "new" || value === "in_progress" || value === "done";
}

function isKitchenTicketPickupStatus(
  value: unknown,
): value is KitchenTicketPickupStatus {
  return (
    value === "preparing" ||
    value === "ready" ||
    value === "claimed" ||
    value === "delivered"
  );
}

function getUniqueStations(items: KitchenTicketItem[]): KitchenStation[] {
  return Array.from(
    new Set(
      items
        .map((item) => item?.station)
        .filter((station): station is KitchenStation => Boolean(station)),
    ),
  );
}

function normalizeKitchenTicketStationStatuses(
  stationStatuses: Partial<Record<string, KitchenTicketStatus>> | null | undefined,
  items: KitchenTicketItem[],
  fallbackStatus?: unknown,
): KitchenTicketStationStatuses {
  const resolvedFallback = isKitchenTicketStatus(fallbackStatus)
    ? fallbackStatus
    : "new";

  return getUniqueStations(items).reduce<KitchenTicketStationStatuses>(
    (accumulator, station) => {
      const candidate = stationStatuses?.[station];
      accumulator[station] = isKitchenTicketStatus(candidate)
        ? candidate
        : resolvedFallback;
      return accumulator;
    },
    {},
  );
}

export function getKitchenTicketStatusForItems(
  ticket: Pick<KitchenTicket, "items" | "stationStatuses" | "status">,
  items: KitchenTicketItem[] = ticket.items,
): KitchenTicketStatus {
  const safeItems = Array.isArray(items) ? items : [];
  const stationStatuses =
    ticket &&
    typeof ticket === "object" &&
    ticket.stationStatuses &&
    typeof ticket.stationStatuses === "object"
      ? ticket.stationStatuses
      : {};
  const stations = getUniqueStations(safeItems);

  if (stations.length === 0) {
    return isKitchenTicketStatus(ticket?.status) ? ticket.status : "new";
  }

  const statuses = stations.map(
    (station) => stationStatuses[station] ?? "new",
  );

  if (statuses.every((status) => status === "done")) {
    return "done";
  }

  if (statuses.every((status) => status === "new")) {
    return "new";
  }

  return "in_progress";
}

export function setKitchenTicketStationStatus(
  ticket: KitchenTicket,
  station: KitchenStation,
  status: KitchenTicketStatus,
): KitchenTicket {
  const stationStatuses = {
    ...(ticket.stationStatuses ?? {}),
    [station]: status,
  };

  const nextTicket = {
    ...ticket,
    stationStatuses,
  };

  return {
    ...nextTicket,
    status: getKitchenTicketStatusForItems(nextTicket),
    pickupStatus:
      getKitchenTicketStatusForItems(nextTicket) === "done" &&
      ticket.pickupStatus === "preparing"
        ? "ready"
        : ticket.pickupStatus,
  };
}

export function setKitchenTicketPickupStatus(
  ticket: KitchenTicket,
  pickupStatus: KitchenTicketPickupStatus,
  claimedByWaiterId?: string | null,
  claimedByWaiterName?: string | null,
): KitchenTicket {
  return {
    ...ticket,
    pickupStatus,
    claimedByWaiterId:
      pickupStatus === "claimed" ? (claimedByWaiterId ?? null) : null,
    claimedByWaiterName:
      pickupStatus === "claimed" ? (claimedByWaiterName ?? null) : null,
  };
}

function isKitchenStation(value: string): value is KitchenStation {
  return KITCHEN_STATIONS.includes(value as KitchenStation);
}

export function normalizeKitchenStation(
  station?: string | null,
): KitchenStation | undefined {
  if (!station) {
    return undefined;
  }

  const value = station.trim().toUpperCase().replace(/[\s-]+/g, "_");

  if (value === "CUNTO_SOOMAALI" || value === "CUNTO_SOMAALI") {
    return "CUNTO_SOOMAALI";
  }

  if (value === "FAST_FOOD") {
    return "FAST_FOOD";
  }

  if (value === "CABITAAN") {
    return "CABITAAN";
  }

  if (value === "BARISTA") {
    return "BARISTA";
  }

  return undefined;
}

function normalizeKitchenTicketItem(
  item: Omit<Partial<KitchenTicketItem>, "station" | "modifiers"> & {
    station?: string | null;
    modifiers?: KitchenTicketModifierLike[] | null;
  },
): KitchenTicketItem | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const station = normalizeKitchenStation(item.station);

  if (!station || !item.id || !item.name) {
    return null;
  }

  const modifiers = Array.isArray(item.modifiers)
    ? item.modifiers
        .map((modifier) => normalizeTicketModifier(modifier))
        .filter((modifier): modifier is KitchenTicketModifier => modifier !== null)
    : [];

  return {
    id: String(item.id),
    name: String(item.name),
    quantity: Math.max(1, Number(item.quantity) || 1),
    station,
    assignedUserId: item.assignedUserId ? String(item.assignedUserId) : null,
    assignedUserName: item.assignedUserName
      ? String(item.assignedUserName)
      : null,
    modifiers,
  };
}

export function normalizeKitchenTicket(ticket: KitchenTicketLike): KitchenTicket | null {
  if (!ticket || typeof ticket !== "object") {
    return null;
  }

  const orderId = ticket.orderId ?? ticket.id;
  const orderNumber = Number(ticket.orderNumber ?? ticket.receiptNo);
  const normalizedItems = Array.isArray(ticket.items)
    ? ticket.items
        .map(normalizeKitchenTicketItem)
        .filter((item): item is KitchenTicketItem => item !== null)
    : [];

  if (!ticket.id || !orderId || !Number.isFinite(orderNumber)) {
    return null;
  }

  if (normalizedItems.length === 0) {
    return null;
  }

  const stationStatuses = normalizeKitchenTicketStationStatuses(
    ticket.stationStatuses,
    normalizedItems,
    ticket.status,
  );

  const normalizedTicket: KitchenTicket = {
    id: String(ticket.id),
    orderId: String(orderId),
    orderNumber: Number(orderNumber),
    createdAt: String(ticket.createdAt ?? new Date().toISOString()),
    status: "new",
    stationStatuses,
    pickupStatus: isKitchenTicketPickupStatus(ticket.pickupStatus)
      ? ticket.pickupStatus
      : "preparing",
    tableId: ticket.tableId ? String(ticket.tableId) : null,
    tableName: ticket.tableName ? String(ticket.tableName) : null,
    cashierId: ticket.cashierId ? String(ticket.cashierId) : null,
    cashierName: ticket.cashierName ? String(ticket.cashierName) : null,
    claimedByWaiterId: ticket.claimedByWaiterId
      ? String(ticket.claimedByWaiterId)
      : null,
    claimedByWaiterName: ticket.claimedByWaiterName
      ? String(ticket.claimedByWaiterName)
      : null,
    note: ticket.note ? String(ticket.note) : null,
    waiterId: ticket.waiterId ? String(ticket.waiterId) : null,
    waiterName: ticket.waiterName ? String(ticket.waiterName) : null,
    items: normalizedItems,
  };

  return {
    ...normalizedTicket,
    status: getKitchenTicketStatusForItems(normalizedTicket),
  };
}

export function filterKitchenTicketByStation(
  ticket: KitchenTicket,
  stationOrFilter?: string | KitchenTicketFilter | null,
  userId?: string | null,
  role?: KitchenViewerRole | null,
): KitchenTicket | null {
  const normalizedTicket = normalizeKitchenTicket(ticket);

  if (!normalizedTicket) {
    return null;
  }

  const filter = resolveFilter(stationOrFilter, userId, role);
  const normalizedStation = normalizeKitchenStation(filter.station);
  const isWaiterPickupViewer =
    !normalizedStation && (filter.role === "WAITER" || filter.role === "ADMIN");

  if (normalizedTicket.pickupStatus === "delivered") {
    return null;
  }

  if (isWaiterPickupViewer) {
    return normalizedTicket.status === "done" ? normalizedTicket : null;
  }

  if (normalizedTicket.status === "done") {
    return null;
  }

  let items = Array.isArray(normalizedTicket.items) ? normalizedTicket.items : [];

  if (normalizedStation) {
    items = items.filter((item) => item.station === normalizedStation);
  }

  if (
    normalizedStation === "BARISTA" &&
    filter.role === "BARISTA" &&
    filter.userId
  ) {
    items = items.filter((item) => item.assignedUserId === filter.userId);
  }

  if (items.length === 0) {
    return null;
  }

  const visibleStatus = getKitchenTicketStatusForItems(normalizedTicket, items);

  if (visibleStatus === "done") {
    return null;
  }

  return {
    ...normalizedTicket,
    status: visibleStatus,
    items,
  };
}

export function filterKitchenTicketsByStation(
  tickets: KitchenTicket[],
  stationOrFilter?: string | KitchenTicketFilter | null,
  userId?: string | null,
  role?: KitchenViewerRole | null,
): KitchenTicket[] {
  return tickets
    .map((ticket) =>
      filterKitchenTicketByStation(ticket, stationOrFilter, userId, role),
    )
    .filter((ticket): ticket is KitchenTicket => ticket !== null);
}

function normalizeKitchenStationParam(
  station?: string | null,
): KitchenStation | undefined {
  return normalizeKitchenStation(station);
}

function stationPathSegment(station: KitchenStation) {
  if (station === "FAST_FOOD") {
    return "fast-food";
  }

  if (station === "CUNTO_SOOMAALI") {
    return "cunto-soomaali";
  }

  if (station === "BARISTA") {
    return "barista";
  }

  return "cabitaan";
}

export function stationFromPathSegment(
  station?: string | null,
): KitchenStation | undefined {
  if (!station) {
    return undefined;
  }

  const value = station.trim().toLowerCase();

  if (value === "cunto-soomaali") {
    return "CUNTO_SOOMAALI";
  }

  if (value === "fast-food") {
    return "FAST_FOOD";
  }

  if (value === "cabitaan") {
    return "CABITAAN";
  }

  if (value === "barista") {
    return "BARISTA";
  }

  return normalizeKitchenStation(station);
}

export function getKitchenSocketUrl(
  filter?: string | KitchenTicketFilter | null
) {
  const base =
    process.env.NEXT_PUBLIC_KITCHEN_SOCKET_URL ?? "ws://localhost:3001";

  const resolvedFilter = resolveFilter(filter);
  const normalizedStation = normalizeKitchenStation(resolvedFilter.station);
  const params = new URLSearchParams();

  if (normalizedStation) {
    params.set("station", normalizedStation);
  }

  if (resolvedFilter.userId) {
    params.set("userId", resolvedFilter.userId);
  }

  const query = params.toString();

  // ✅ FIX: remove /api/kitchen/ws
  return query ? `${base}?${query}` : base;
}
