import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Station, type UserRole } from "@prisma/client";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

function localEnv(name: string, origin: string) {
  const value = process.env[name];
  assert.ok(value, `Missing ${name}. Use the workflow test runner.`);
  assert.equal(new URL(value).origin, origin, `${name} must use the disposable test stack`);
  return value;
}

export const appUrl = localEnv("CAFE_POS_TEST_URL", "http://127.0.0.1:55430");
const authUrl = localEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:55421");
const databaseUrl = process.env.DATABASE_URL;
assert.ok(databaseUrl);
const database = new URL(databaseUrl);
assert.equal(database.protocol, "postgresql:");
assert.equal(database.host, "127.0.0.1:55422");

export const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const auth = createClient(authUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function unique(label: string) {
  return `${label} ${randomUUID().slice(0, 8)}`;
}

export async function user(
  role: UserRole | "CUSTOMER",
  options: { active?: boolean; station?: Station; name?: string } = {},
) {
  const fullName = options.name ?? unique(`Test ${role}`);
  const email = `${randomUUID()}@workflow.example.test`;
  const password = randomUUID();
  const result = await auth.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  assert.ifError(result.error);
  const id = result.data.user.id;
  const profile = { id, email, fullName, isActive: options.active ?? true };
  if (role === "CUSTOMER") {
    await db.customer.create({ data: profile });
  } else {
    await db.staff.create({ data: { ...profile, role, station: options.station } });
  }
  return { id, email, password, fullName };
}

export type TestUser = Awaited<ReturnType<typeof user>>;

export async function sessionCookies(account: TestUser) {
  const jar = new Map<string, string>();
  const supabase = createServerClient(authUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error } = await supabase.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  assert.ifError(error);
  assert.ok(jar.size, "Supabase sign-in returned no session cookies");
  return Array.from(jar, ([name, value]) => ({ name, value }));
}

export async function client(account?: TestUser) {
  const jar = new Map(
    (account ? await sessionCookies(account) : []).map(({ name, value }) => [name, value]),
  );
  return async (
    path: string,
    options: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
  ) => {
    assert.ok(path.startsWith("/") && !path.startsWith("//"));
    const response = await fetch(new URL(path, appUrl), {
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      redirect: "manual",
      headers: {
        "content-type": "application/json",
        cookie: Array.from(jar, ([name, value]) => `${name}=${value}`).join("; "),
        ...options.headers,
      },
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";")[0];
      const delimiter = pair.indexOf("=");
      jar.set(pair.slice(0, delimiter), pair.slice(delimiter + 1));
    }
    return response;
  };
}

export async function json<T>(response: Response, status?: number): Promise<T> {
  const body = await response.text();
  if (status === undefined) {
    assert.ok(response.ok, `${response.status} ${response.url}\n${body.slice(0, 1000)}`);
  } else {
    assert.equal(response.status, status, `${response.url}\n${body.slice(0, 1000)}`);
  }
  return JSON.parse(body) as T;
}

export async function product(station: Station = "FAST_FOOD", price = 5) {
  const category = await db.category.create({ data: { name: unique("Test category"), station } });
  return db.product.create({
    data: {
      name: unique("Test item"),
      categoryId: category.id,
      price,
      trackStock: true,
      stockQty: 20,
      isPopular: true,
    },
  });
}

export function table() {
  return db.table.create({ data: { name: unique("Test table") } });
}

export type OrderResponse = { order: { id: string; orderNumber: number } };

export function phone() {
  return `90${String(randomInt(10_000_000)).padStart(7, "0")}`;
}

export function checkoutInput(productId: string, paymentPhone = phone(), tableId?: string) {
  return {
    idempotencyKey: randomUUID(),
    customerName: "Test Customer",
    paymentPhone,
    orderType: tableId ? "DINE_IN" : "TAKEOUT",
    ...(tableId ? { tableId } : {}),
    items: [{ productId, qty: 1 }],
  };
}

export async function sendReceipt(input: {
  phone: string;
  amount: number;
  name?: string;
  reference?: string;
  at?: Date;
  outgoing?: boolean;
}) {
  const {
    phone,
    amount,
    name = "Test Customer",
    reference = String(randomInt(1_000_000_000, 9_999_999_999)),
    at = new Date(),
    outgoing = false,
  } = input;
  // The parser reads the SMS wall clock in East Africa time.
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const date = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const transfer = outgoing
    ? `$${amount.toFixed(2)} ayaad u dirtay`
    : `Waxaad $${amount.toFixed(2)} ka heshay`;
  const message = `[SAHAL] Tix:${reference}, ${transfer} ${name}(252${phone}) Tar ${date.day}/${date.month}/${date.year.slice(-2)} ${date.hour}:${date.minute}:${date.second}, Haraagaagu waa $150.00.`;
  const post = await client();
  return post("/api/webhooks/payments/macrodroid", {
    body: { sender: "898", message },
    headers: { authorization: `Bearer ${process.env.MACRODROID_PAYMENT_WEBHOOK_SECRET}` },
  });
}
