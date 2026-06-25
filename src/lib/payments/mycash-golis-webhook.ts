export type MycashGolisProvider = "MYCASH" | "GOLIS";

export type MycashGolisSuccessStatus = "SUCCESS" | "PAID" | "COMPLETED";

export type MycashGolisWebhookEvent = {
  provider: MycashGolisProvider;
  status: string;
  orderId: string | null;
  orderNumber: number | null;
  amount: number;
  reference: string;
  paidAt: Date | null;
  isSuccess: boolean;
};

export type PaymentWebhookCashier = {
  id: string;
  fullName: string;
  isActive: boolean;
};

export type PaymentWebhookOrder = {
  id: string;
  orderNumber: number;
  status: "OPEN" | "PAID" | "CANCELLED";
  total: unknown;
};

export type PaymentWebhookExistingPayment = {
  id: string;
  orderId: string;
  reference: string | null;
};

export type PaymentWebhookStore = {
  getCashier(cashierId: string): Promise<PaymentWebhookCashier | null>;
  findPaymentByReference(
    provider: MycashGolisProvider,
    reference: string,
  ): Promise<PaymentWebhookExistingPayment | null>;
  findOrder(event: MycashGolisWebhookEvent): Promise<PaymentWebhookOrder | null>;
  markOrderPaid(input: {
    event: MycashGolisWebhookEvent;
    order: PaymentWebhookOrder;
    cashier: PaymentWebhookCashier;
    paidAt: Date;
  }): Promise<void>;
};

export type PaymentWebhookConfig =
  | {
      ok: true;
      secret: string;
      cashierId: string;
    }
  | {
      ok: false;
      error: string;
    };

export type PaymentWebhookResult = {
  status: number;
  body: Record<string, unknown>;
};

const SUCCESS_STATUSES = new Set<MycashGolisSuccessStatus>([
  "SUCCESS",
  "PAID",
  "COMPLETED",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeProvider(value: unknown): MycashGolisProvider | null {
  const provider = normalizeString(value).toUpperCase();

  if (provider === "MYCASH" || provider === "GOLIS") {
    return provider;
  }

  return null;
}

function normalizeOrderNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numberValue =
    typeof value === "number" ? value : Number(normalizeString(value));

  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
}

function normalizeAmount(value: unknown) {
  const numberValue =
    typeof value === "number" ? value : Number(normalizeString(value));

  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}

function normalizePaidAt(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return { ok: true as const, paidAt: null };
  }

  const paidAt = new Date(normalizeString(value));

  if (Number.isNaN(paidAt.getTime())) {
    return { ok: false as const, error: "paidAt is invalid." };
  }

  return { ok: true as const, paidAt };
}

function toCents(value: unknown) {
  return Math.round(Number(value) * 100);
}

export function readPaymentWebhookConfig(
  env: Record<string, string | undefined>,
): PaymentWebhookConfig {
  const secret = env.PAYMENT_WEBHOOK_SECRET?.trim();
  const cashierId = env.PAYMENT_WEBHOOK_CASHIER_ID?.trim();

  if (!secret) {
    return {
      ok: false,
      error: "Payment webhook secret is not configured.",
    };
  }

  if (!cashierId) {
    return {
      ok: false,
      error: "Payment webhook cashier is not configured.",
    };
  }

  return {
    ok: true,
    secret,
    cashierId,
  };
}

export function isPaymentWebhookAuthorized(
  authorization: string | null,
  secret: string,
) {
  return authorization === `Bearer ${secret}`;
}

export function normalizeMycashGolisWebhookPayload(
  payload: unknown,
):
  | {
      ok: true;
      event: MycashGolisWebhookEvent;
    }
  | {
      ok: false;
      error: string;
    } {
  if (!isRecord(payload)) {
    return { ok: false, error: "Webhook payload must be a JSON object." };
  }

  const provider = normalizeProvider(payload.provider);

  if (!provider) {
    return { ok: false, error: "Payment provider is invalid." };
  }

  const status = normalizeString(payload.status).toUpperCase();

  if (!status) {
    return { ok: false, error: "Payment status is required." };
  }

  const reference = normalizeString(payload.reference);

  if (!reference) {
    return { ok: false, error: "Payment reference is required." };
  }

  const orderId = normalizeString(payload.orderId) || null;
  const orderNumber = normalizeOrderNumber(payload.orderNumber);

  if (!orderId && !orderNumber) {
    return {
      ok: false,
      error: "orderId or orderNumber is required.",
    };
  }

  const amount = normalizeAmount(payload.amount);

  if (amount === null) {
    return { ok: false, error: "Payment amount must be greater than zero." };
  }

  const paidAtResult = normalizePaidAt(payload.paidAt);

  if (!paidAtResult.ok) {
    return { ok: false, error: paidAtResult.error };
  }

  return {
    ok: true,
    event: {
      provider,
      status,
      orderId,
      orderNumber,
      amount,
      reference,
      paidAt: paidAtResult.paidAt,
      isSuccess: SUCCESS_STATUSES.has(status as MycashGolisSuccessStatus),
    },
  };
}

export async function processMycashGolisWebhook(
  payload: unknown,
  input: {
    cashierId: string;
    store: PaymentWebhookStore;
    now?: () => Date;
  },
): Promise<PaymentWebhookResult> {
  const normalized = normalizeMycashGolisWebhookPayload(payload);

  if (!normalized.ok) {
    return {
      status: 400,
      body: { ok: false, error: normalized.error },
    };
  }

  const event = normalized.event;

  if (!event.isSuccess) {
    return {
      status: 200,
      body: {
        ok: true,
        ignored: true,
        status: event.status,
      },
    };
  }

  const cashier = await input.store.getCashier(input.cashierId);

  if (!cashier || !cashier.isActive) {
    return {
      status: 500,
      body: {
        ok: false,
        error: "Payment webhook cashier is not configured correctly.",
      },
    };
  }

  const existingPayment = await input.store.findPaymentByReference(
    event.provider,
    event.reference,
  );

  if (existingPayment) {
    return {
      status: 200,
      body: {
        ok: true,
        duplicate: true,
        paymentId: existingPayment.id,
        orderId: existingPayment.orderId,
        reference: event.reference,
      },
    };
  }

  const order = await input.store.findOrder(event);

  if (!order) {
    return {
      status: 404,
      body: { ok: false, error: "Order not found." },
    };
  }

  if (order.status !== "OPEN") {
    return {
      status: 409,
      body: {
        ok: false,
        error: "Order is not open for payment.",
        orderId: order.id,
        orderStatus: order.status,
      },
    };
  }

  if (toCents(order.total) !== toCents(event.amount)) {
    return {
      status: 400,
      body: {
        ok: false,
        error: "Payment amount does not match order total.",
        orderId: order.id,
      },
    };
  }

  const paidAt = event.paidAt ?? input.now?.() ?? new Date();

  await input.store.markOrderPaid({
    event,
    order,
    cashier,
    paidAt,
  });

  return {
    status: 200,
    body: {
      ok: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: "PAID",
      },
      payment: {
        method: event.provider,
        amountPaid: event.amount,
        reference: event.reference,
      },
    },
  };
}
