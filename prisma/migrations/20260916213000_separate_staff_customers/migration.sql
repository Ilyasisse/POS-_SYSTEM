-- Coordinated deployment: stop application writes before applying this migration.
-- Preserve IDs and existing staff foreign keys by renaming the original table.
BEGIN;
ALTER TABLE "User" RENAME TO "Staff";
ALTER TABLE "Staff" RENAME CONSTRAINT "User_pkey" TO "Staff_pkey";
ALTER INDEX "User_phoneNumber_key" RENAME TO "Staff_phoneNumber_key";
ALTER INDEX "User_email_key" RENAME TO "Staff_email_key";
ALTER INDEX "User_role_isActive_idx" RENAME TO "Staff_role_isActive_idx";
ALTER INDEX "User_station_idx" RENAME TO "Staff_station_idx";

CREATE TABLE "Customer" (
  "id" TEXT NOT NULL,
  "phoneNumber" TEXT,
  "fullName" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "email" TEXT NOT NULL,
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Customer_phoneNumber_key" ON "Customer"("phoneNumber");
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");
-- Include staff who already have personal purchases, without removing their staff profile.
INSERT INTO "Customer" ("id", "phoneNumber", "fullName", "isActive", "createdAt", "updatedAt", "email")
SELECT "id", "phoneNumber", "fullName", "isActive", "createdAt", "updatedAt", "email"
FROM "Staff" s WHERE s."role" = 'CUSTOMER'
OR EXISTS (SELECT 1 FROM "Order" o WHERE o."customerId" = s."id");

ALTER TABLE "Order" DROP CONSTRAINT "Order_customerId_fkey";
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve customer event attribution separately from staff actor links.
ALTER TABLE "AuditLog" ADD COLUMN "actorCustomerId" TEXT;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorCustomerId_fkey" FOREIGN KEY ("actorCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "AuditLog_actorCustomerId_idx" ON "AuditLog"("actorCustomerId");
UPDATE "AuditLog" e SET "actorCustomerId" = e."actorUserId", "actorUserId" = NULL
FROM "Staff" s WHERE e."actorUserId" = s."id" AND s."role" = 'CUSTOMER';
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_single_actor" CHECK ("actorUserId" IS NULL OR "actorCustomerId" IS NULL);
ALTER TABLE "StockEvent" ADD COLUMN "actorCustomerId" TEXT;
ALTER TABLE "StockEvent" ADD CONSTRAINT "StockEvent_actorCustomerId_fkey" FOREIGN KEY ("actorCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "StockEvent_actorCustomerId_idx" ON "StockEvent"("actorCustomerId");
-- Change attribution only; restore append-only enforcement in this transaction.
ALTER TABLE "StockEvent" DISABLE TRIGGER "StockEvent_immutable";
UPDATE "StockEvent" e SET "actorCustomerId" = e."actorUserId", "actorUserId" = NULL
FROM "Staff" s WHERE e."actorUserId" = s."id" AND s."role" = 'CUSTOMER';
ALTER TABLE "StockEvent" ENABLE TRIGGER "StockEvent_immutable";
ALTER TABLE "StockEvent" ADD CONSTRAINT "StockEvent_single_actor" CHECK ("actorUserId" IS NULL OR "actorCustomerId" IS NULL);
ALTER TABLE "KitchenTransitionEvent" ADD COLUMN "actorCustomerId" TEXT;
ALTER TABLE "KitchenTransitionEvent" ADD CONSTRAINT "KitchenTransitionEvent_actorCustomerId_fkey" FOREIGN KEY ("actorCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "KitchenTransitionEvent_actorCustomerId_idx" ON "KitchenTransitionEvent"("actorCustomerId");
-- Change attribution only; restore append-only enforcement in this transaction.
ALTER TABLE "KitchenTransitionEvent" DISABLE TRIGGER "KitchenTransitionEvent_immutable";
UPDATE "KitchenTransitionEvent" e SET "actorCustomerId" = e."actorUserId", "actorUserId" = NULL
FROM "Staff" s WHERE e."actorUserId" = s."id" AND s."role" = 'CUSTOMER';
ALTER TABLE "KitchenTransitionEvent" ENABLE TRIGGER "KitchenTransitionEvent_immutable";
ALTER TABLE "KitchenTransitionEvent" ADD CONSTRAINT "KitchenTransitionEvent_single_actor" CHECK ("actorUserId" IS NULL OR "actorCustomerId" IS NULL);

-- Do not silently cascade-delete or null historical staff activity if a legacy
-- CUSTOMER was assigned a staff-only responsibility. Roll back for data review.
DO $$
DECLARE fk RECORD; has_customer_reference BOOLEAN;
BEGIN
  FOR fk IN
    SELECT c.conrelid::regclass AS referencing_table, a.attname AS column_name
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND c.confrelid = '"Staff"'::regclass
  LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s r JOIN "Staff" s ON r.%I = s."id" WHERE s."role" = ''CUSTOMER'')', fk.referencing_table, fk.column_name)
    INTO has_customer_reference;
    IF has_customer_reference THEN
      RAISE EXCEPTION 'Customer has staff-only history in %.%; review the legacy role assignment before retrying migration', fk.referencing_table, fk.column_name;
    END IF;
  END LOOP;
END $$;
DELETE FROM "Staff" WHERE "role" = 'CUSTOMER';
-- Keep UserRole for the application's permission vocabulary, but prohibit
-- customer roles in the physical Staff table, including direct SQL writes.
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_role_not_customer" CHECK ("role" <> 'CUSTOMER');

-- Prisma is the server-side access path. Do not expose profile writes via REST.
ALTER TABLE "Staff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE client_role TEXT;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      EXECUTE format('REVOKE ALL ON TABLE "Staff", "Customer" FROM %I', client_role);
    END IF;
  END LOOP;
END $$;
-- The existing SQL function stores its query as text, so table renaming alone
-- does not update it. Preserve its existing auth predicate and execution grants.
DO $$
BEGIN
  IF to_regprocedure('public.can_receive_kitchen_realtime()') IS NOT NULL THEN
    EXECUTE $sql$
      CREATE OR REPLACE FUNCTION public.can_receive_kitchen_realtime()
      RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
      AS $function$
        SELECT EXISTS (
          SELECT 1 FROM public."Staff" AS staff
          WHERE staff."id" = (SELECT auth.uid())::text
            AND staff."isActive" = true
            AND staff."role"::text = ANY (
              ARRAY['ADMIN', 'CASHIER', 'WAITER', 'COOK', 'BARISTA', 'Cabitaan']
            )
        );
      $function$;
    $sql$;
    REVOKE ALL ON FUNCTION public.can_receive_kitchen_realtime() FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.can_receive_kitchen_realtime() TO authenticated;
  END IF;
END $$;

COMMIT;
