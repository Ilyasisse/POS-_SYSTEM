import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { cache } from "react";
import { headers } from "next/headers";
import { database } from "@/lib/database";
import { normalizeHostname } from "./hostname";

export const cafeteriaContext = new AsyncLocalStorage<string>();

export const getCafeteria = cache(async () => {
  const explicitId = cafeteriaContext.getStore();
  if (explicitId) {
    const cafe = await database.cafeteria.findUnique({ where: { id: explicitId } });
    if (!cafe?.isActive) throw new Error("Cafeteria is unavailable.");
    return cafe;
  }
  const host = normalizeHostname((await headers()).get("host") ?? "");
  const domain = await database.cafeteriaDomain.findUnique({ where: { hostname: host }, include: { cafeteria: true } });
  if (domain) {
    if (!domain.cafeteria.isActive) throw new Error("Cafeteria is unavailable.");
    return domain.cafeteria;
  }
  const bootstrapHost = process.env.MASHALLAH_DOMAIN;
  if ((bootstrapHost && host === normalizeHostname(bootstrapHost)) ||
      (process.env.NODE_ENV !== "production" && host === "localhost")) {
    const cafe = await database.cafeteria.findUnique({ where: { id: "mashallah" } });
    if (cafe?.isActive) return cafe;
  }
  throw new Error("This domain is not assigned to an active cafeteria.");
});

/** Jobs and scripts must explicitly identify their cafeteria; there is no default tenant. */
export function withCafeteria<T>(id: string, work: () => T): T {
  return cafeteriaContext.run(id, work);
}
