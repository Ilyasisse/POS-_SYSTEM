import { database } from "@/lib/database";
import { getCafeteria } from "@/lib/cafeteria/context";
import { createScopedClient } from "@/lib/cafeteria/scoped-client";

export const prisma = createScopedClient(database, async () => (await getCafeteria()).id);
