import type { Prisma, PrismaClient } from "@prisma/client";

type Delegate = Record<string, (...args: unknown[]) => Promise<unknown>>;
type Operation = { model?: string; method: string; args: unknown[] };
const operationKey = Symbol("cafeteria-operation");
type DeferredQuery = PromiseLike<unknown> & { [operationKey]: Operation };

function scopeSingleton(model: string | undefined, args: unknown[], id: string) {
  if (!["cafeSetting", "attendancePolicy", "paymentGatewayStatus"].includes(model ?? "")) return args;
  function rewrite(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(rewrite);
    if (!value || typeof value !== "object" || value instanceof Date) return value;
    return Object.fromEntries(Object.entries(value).map(([key, val]) =>
      [key, key === "id" && typeof val === "string" ? `${id}:${val}` : rewrite(val)]));
  }
  const rewritten = args.map(rewrite);
  const argument = rewritten[0] as Record<string, Record<string, unknown>> | undefined;
  const data = argument?.create ?? argument?.data;
  if (data && data.id === undefined) data.id = id + (model === "paymentGatewayStatus" ? ":macrodroid-898" : ":default");
  return rewritten;
}

async function execute(tx: Prisma.TransactionClient, op: Operation, id: string) {
  const args = scopeSingleton(op.model, op.args, id);
  const target = (op.model ? Reflect.get(tx, op.model) : tx) as Delegate;
  if (op.method === "upsert" && op.model) {
    // SQL unique indexes include cafeteriaId; serialize logical upserts because
    // legacy Prisma selectors cannot use native ON CONFLICT on these indexes.
    const arg = args[0] as { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown>; select?: unknown; include?: unknown; omit?: unknown };
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}), hashtext(${op.model + JSON.stringify(arg.where)}))`;
    const existing = await target.findUnique({ where: arg.where });
    const shape = { ...(arg.select ? { select: arg.select } : {}), ...(arg.include ? { include: arg.include } : {}), ...(arg.omit ? { omit: arg.omit } : {}) };
    return existing ? target.update({ where: arg.where, data: arg.update, ...shape }) : target.create({ data: arg.create, ...shape });
  }
  return Reflect.apply(target[op.method], target, args);
}

/** Every query, raw SQL statement, and nested write runs under PostgreSQL RLS. */
export function createScopedClient(base: PrismaClient, resolveId: () => Promise<string>): PrismaClient {
  async function transaction(work: (tx: Prisma.TransactionClient, id: string) => Promise<unknown>, options?: object) {
    const id = await resolveId();
    return base.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.cafeteria_id', ${id}, true)`;
      await tx.$executeRawUnsafe("SET LOCAL ROLE pos_cafeteria_runtime");
      return work(tx, id);
    }, options);
  }
  function defer(op: Operation): DeferredQuery {
    let promise: Promise<unknown> | undefined;
    const run = () => promise ??= transaction((tx, id) => execute(tx, op, id));
    return {
      [operationKey]: op,
      then: (yes, no) => run().then(yes, no),
      ...{ catch: (no: (reason: unknown) => unknown) => run().catch(no), finally: (fn: () => void) => run().finally(fn), [Symbol.toStringTag]: "PrismaPromise" },
    };
  }
  function wrapTransaction(tx: Prisma.TransactionClient, id: string) {
    return new Proxy(tx, { get(target, key) {
      if (typeof key !== "string") return Reflect.get(target, key);
      if (key.startsWith("$")) return Reflect.get(target, key).bind(target);
      return new Proxy(Reflect.get(target, key), { get: (_, method) =>
        (...args: unknown[]) => execute(tx, { model: key, method: String(method), args }, id) });
    } });
  }
  return new Proxy(base, { get(target, key) {
    if (key === "$transaction") return (work: ((tx: Prisma.TransactionClient) => Promise<unknown>) | DeferredQuery[], options?: object) =>
      transaction(async (tx, id) => {
        if (typeof work === "function") return work(wrapTransaction(tx, id));
        const results = [];
        for (const query of work) {
          if (!query[operationKey]) throw new Error("Use scoped Prisma queries in transactions.");
          results.push(await execute(tx, query[operationKey], id));
        }
        return results;
      }, options);
    if (typeof key !== "string") return Reflect.get(target, key);
    if (["$connect", "$disconnect", "$on"].includes(key)) return Reflect.get(target, key).bind(target);
    if (key.startsWith("$")) {
      if (!["$queryRaw", "$executeRaw", "$queryRawUnsafe", "$executeRawUnsafe"].includes(key)) throw new Error("Unsupported scoped Prisma operation.");
      return (...args: unknown[]) => defer({ method: key, args });
    }
    if (["cafeteria", "cafeteriaDomain"].includes(key)) throw new Error("Use authorized platform management for cafeteria configuration.");
    return new Proxy(Reflect.get(target, key), { get: (_, method) =>
      (...args: unknown[]) => defer({ model: key, method: String(method), args }) });
  } });
}
