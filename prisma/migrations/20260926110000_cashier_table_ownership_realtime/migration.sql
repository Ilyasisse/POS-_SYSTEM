BEGIN;

ALTER TABLE "Table" ADD COLUMN "ownerCashierId" TEXT;

CREATE INDEX "Table_ownerCashierId_isActive_idx"
ON "Table"("ownerCashierId", "isActive");

ALTER TABLE "Table"
ADD CONSTRAINT "Table_ownerCashierId_fkey"
FOREIGN KEY ("ownerCashierId") REFERENCES "Staff"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing occupied tables belong to the earliest cashier with an open order.
WITH first_cashier AS (
  SELECT DISTINCT ON (o."tableId")
    o."tableId",
    o."cashierId"
  FROM "Order" AS o
  JOIN "Staff" AS staff ON staff."id" = o."cashierId" AND staff."role" = 'CASHIER'
  WHERE o."tableId" IS NOT NULL
    AND o."cashierId" IS NOT NULL
    AND o."type" = 'DINE_IN'
    AND o."status" = 'OPEN'
  ORDER BY o."tableId", o."createdAt", o."orderNumber"
)
UPDATE "Table" AS t
SET "ownerCashierId" = first_cashier."cashierId"
FROM first_cashier
WHERE t."id" = first_cashier."tableId";

-- Keep ownership correct for every payment, void, delete, and reversal path.
CREATE OR REPLACE FUNCTION public.sync_cashier_table_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  target_table_id text;
  next_owner_id text;
BEGIN
  target_table_id := COALESCE(NEW."tableId", OLD."tableId");
  IF target_table_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT o."cashierId" INTO next_owner_id
  FROM public."Order" AS o
  JOIN public."Staff" AS staff ON staff."id" = o."cashierId" AND staff."role" = 'CASHIER'
  WHERE o."tableId" = target_table_id
    AND o."type" = 'DINE_IN'
    AND o."status" = 'OPEN'
    AND o."cashierId" IS NOT NULL
  ORDER BY o."createdAt", o."orderNumber"
  LIMIT 1;

  IF NOT EXISTS (
    SELECT 1 FROM public."Order" AS o
    WHERE o."tableId" = target_table_id
      AND o."type" = 'DINE_IN'
      AND o."status" = 'OPEN'
  ) THEN
    UPDATE public."Table"
    SET "ownerCashierId" = NULL
    WHERE "id" = target_table_id
      AND "ownerCashierId" IS NOT NULL;
  ELSIF next_owner_id IS NOT NULL THEN
    UPDATE public."Table"
    SET "ownerCashierId" = next_owner_id
    WHERE "id" = target_table_id
      AND "ownerCashierId" IS NULL;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE TRIGGER a_sync_cashier_table_owner
AFTER INSERT OR UPDATE OR DELETE ON "Order"
FOR EACH ROW EXECUTE FUNCTION public.sync_cashier_table_owner();

-- Supabase-owned schemas are absent from a Prisma shadow database.
DO $do$
BEGIN
  IF to_regclass('realtime.messages') IS NOT NULL
     AND to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NOT NULL
     AND to_regprocedure('auth.uid()') IS NOT NULL THEN
    EXECUTE 'CREATE SCHEMA IF NOT EXISTS app_private';
    EXECUTE 'GRANT USAGE ON SCHEMA app_private TO authenticated';

    EXECUTE $sql$
      CREATE OR REPLACE FUNCTION app_private.can_receive_cashier_table_events()
      RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
      AS $function$
        SELECT EXISTS (
          SELECT 1 FROM public."Staff" AS staff
          WHERE staff."id" = (SELECT auth.uid())::text
            AND staff."isActive" = true
            AND (
              (
                (SELECT realtime.topic()) = 'cashier:' || staff."id"
                AND staff."role"::text IN ('CASHIER', 'MANAGER', 'ADMIN')
              )
              OR (
                (SELECT realtime.topic()) = 'cashier:all'
                AND staff."role"::text IN ('MANAGER', 'ADMIN')
              )
            )
        );
      $function$;
    $sql$;

    EXECUTE 'REVOKE ALL ON FUNCTION app_private.can_receive_cashier_table_events() FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION app_private.can_receive_cashier_table_events() TO authenticated';

    EXECUTE $sql$
      CREATE OR REPLACE FUNCTION app_private.broadcast_cashier_table_change()
      RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
      AS $function$
      DECLARE
        target_table_id text;
        owner_id text;
        previous_owner_id text;
        event_payload jsonb;
      BEGIN
        IF TG_TABLE_NAME = 'Table' THEN
          target_table_id := COALESCE(NEW."id", OLD."id");
          IF TG_OP = 'UPDATE' THEN
            previous_owner_id := OLD."ownerCashierId";
          END IF;
        ELSIF TG_TABLE_NAME = 'Order' THEN
          target_table_id := COALESCE(NEW."tableId", OLD."tableId");
        ELSIF TG_TABLE_NAME = 'Payment' THEN
          SELECT o."tableId" INTO target_table_id
          FROM public."Order" AS o
          WHERE o."id" = COALESCE(NEW."orderId", OLD."orderId");
        END IF;

        IF target_table_id IS NULL THEN
          RETURN COALESCE(NEW, OLD);
        END IF;

        SELECT t."ownerCashierId" INTO owner_id
        FROM public."Table" AS t
        WHERE t."id" = target_table_id;

        event_payload := pg_catalog.jsonb_build_object('tableId', target_table_id);
        IF owner_id IS NOT NULL THEN
          PERFORM realtime.send(event_payload, 'table_changed', 'cashier:' || owner_id, true);
        END IF;
        IF previous_owner_id IS NOT NULL AND previous_owner_id IS DISTINCT FROM owner_id THEN
          PERFORM realtime.send(event_payload, 'table_changed', 'cashier:' || previous_owner_id, true);
        END IF;
        PERFORM realtime.send(event_payload, 'table_changed', 'cashier:all', true);
        RETURN COALESCE(NEW, OLD);
      EXCEPTION WHEN OTHERS THEN
        -- Realtime outages must never roll back an order or payment.
        RETURN COALESCE(NEW, OLD);
      END;
      $function$;
    $sql$;

    EXECUTE 'CREATE TRIGGER z_cashier_table_change AFTER UPDATE ON public."Table" FOR EACH ROW EXECUTE FUNCTION app_private.broadcast_cashier_table_change()';
    EXECUTE 'CREATE TRIGGER z_cashier_order_change AFTER INSERT OR UPDATE OR DELETE ON public."Order" FOR EACH ROW EXECUTE FUNCTION app_private.broadcast_cashier_table_change()';
    EXECUTE 'CREATE TRIGGER z_cashier_payment_change AFTER INSERT OR UPDATE OR DELETE ON public."Payment" FOR EACH ROW EXECUTE FUNCTION app_private.broadcast_cashier_table_change()';

    EXECUTE $sql$
      CREATE POLICY "active cashier roles receive table changes"
      ON realtime.messages
      FOR SELECT TO authenticated
      USING (
        realtime.messages.extension = 'broadcast'
        AND (SELECT app_private.can_receive_cashier_table_events())
      );
    $sql$;
  END IF;
END;
$do$;

COMMIT;
