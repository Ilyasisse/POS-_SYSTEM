export const KITCHEN_STATIONS = [
  "CUNTO_SOOMAALI",
  "FAST_FOOD",
  "CABITAAN",
  "BARISTA",
] as const;

export type KitchenStation = (typeof KITCHEN_STATIONS)[number];

export type KitchenTicketStatus = "new" | "in_progress" | "done";

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
        status: KitchenTicketStatus;
      };
    };

type KitchenTicketModifierLike = Partial<KitchenTicketModifier>;

type KitchenTicketLike = Partial<KitchenTicket> & {
  receiptNo?: number;
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

export function isKitchenStation(value: string): value is KitchenStation {
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

export function normalizeKitchenTicketItem(
  item: Omit<Partial<KitchenTicketItem>, "station" | "modifiers"> & {
    station?: string | null;
    modifiers?: KitchenTicketModifierLike[] | null;
  },
): KitchenTicketItem | null {
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

  return {
    id: String(ticket.id),
    orderId: String(orderId),
    orderNumber: Number(orderNumber),
    createdAt: String(ticket.createdAt ?? new Date().toISOString()),
    status:
      ticket.status === "in_progress" || ticket.status === "done"
        ? ticket.status
        : "new",
    note: ticket.note ? String(ticket.note) : null,
    waiterId: ticket.waiterId ? String(ticket.waiterId) : null,
    waiterName: ticket.waiterName ? String(ticket.waiterName) : null,
    items: normalizedItems,
  };
}

export function filterKitchenTicketByStation(
  ticket: KitchenTicket,
  stationOrFilter?: string | KitchenTicketFilter | null,
  userId?: string | null,
  role?: KitchenViewerRole | null,
): KitchenTicket | null {
  const filter = resolveFilter(stationOrFilter, userId, role);
  const normalizedStation = normalizeKitchenStation(filter.station);

  if (ticket.status === "done") {
    return null;
  }

  let items = Array.isArray(ticket.items) ? ticket.items : [];

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

  return {
    ...ticket,
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

export function normalizeKitchenStationParam(
  station?: string | null,
): KitchenStation | undefined {
  return normalizeKitchenStation(station);
}

export function stationPathSegment(station: KitchenStation) {
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

  if (resolvedFilter.role) {
    params.set("role", resolvedFilter.role);
  }

  const query = params.toString();

  // ✅ FIX: remove /api/kitchen/ws
  return query ? `${base}?${query}` : base;
}
