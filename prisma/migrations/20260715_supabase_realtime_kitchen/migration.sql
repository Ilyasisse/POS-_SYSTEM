-- Durable, normalized state for the kitchen queue.
CREATE TYPE "KitchenStationTicketStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'DONE');
CREATE TYPE "KitchenPickupStatus" AS ENUM ('PREPARING', 'READY', 'CLAIMED', 'DELIVERED');

CREATE TABLE "KitchenTicketState" (
    "orderId" TEXT NOT NULL,
    "pickupStatus" "KitchenPickupStatus" NOT NULL DEFAULT 'PREPARING',
    "customerName" TEXT,
    "claimedByWaiterId" TEXT,
    "claimedByWaiterName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KitchenTicketState_pkey" PRIMARY KEY ("orderId")
);

CREATE TABLE "KitchenTicketStationState" (
    "orderId" TEXT NOT NULL,
    "station" "Station" NOT NULL,
    "status" "KitchenStationTicketStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KitchenTicketStationState_pkey" PRIMARY KEY ("orderId", "station")
);

CREATE INDEX "KitchenTicketState_pickupStatus_updatedAt_idx"
ON "KitchenTicketState"("pickupStatus", "updatedAt");

CREATE INDEX "KitchenTicketState_claimedByWaiterId_idx"
ON "KitchenTicketState"("claimedByWaiterId");

CREATE INDEX "KitchenTicketStationState_station_status_idx"
ON "KitchenTicketStationState"("station", "status");

ALTER TABLE "KitchenTicketState"
ADD CONSTRAINT "KitchenTicketState_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KitchenTicketState"
ADD CONSTRAINT "KitchenTicketState_claimedByWaiterId_fkey"
FOREIGN KEY ("claimedByWaiterId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "KitchenTicketStationState"
ADD CONSTRAINT "KitchenTicketStationState_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "KitchenTicketState"("orderId")
ON DELETE CASCADE ON UPDATE CASCADE;

-- A Prisma shadow database does not contain Supabase-owned schemas. Keep the
-- application schema portable while installing Realtime policy and trigger on
-- the actual Supabase database.
DO $$
BEGIN
  IF to_regclass('realtime.messages') IS NOT NULL
     AND to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NOT NULL
     AND to_regprocedure('auth.uid()') IS NOT NULL THEN

    EXECUTE $sql$
      CREATE OR REPLACE FUNCTION public.can_receive_kitchen_realtime()
      RETURNS boolean
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = ''
      AS $function$
        SELECT EXISTS (
          SELECT 1
          FROM public."User" AS staff
          WHERE staff."id" = (SELECT auth.uid())::text
            AND staff."isActive" = true
            AND staff."role"::text = ANY (
              ARRAY['ADMIN', 'CASHIER', 'WAITER', 'COOK', 'BARISTA', 'Cabitaan']
            )
        );
      $function$;
    $sql$;

    EXECUTE 'REVOKE ALL ON FUNCTION public.can_receive_kitchen_realtime() FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.can_receive_kitchen_realtime() TO authenticated';

    EXECUTE $sql$
      CREATE OR REPLACE FUNCTION public.broadcast_kitchen_ticket_change()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = ''
      AS $function$
      DECLARE
        ticket_order_id text;
      BEGIN
        ticket_order_id := COALESCE(NEW."orderId", OLD."orderId");

        PERFORM realtime.send(
          pg_catalog.jsonb_build_object(
            'orderId', ticket_order_id,
            'operation', TG_OP
          ),
          'ticket_changed',
          'kitchen:tickets',
          true
        );

        RETURN COALESCE(NEW, OLD);
      END;
      $function$;
    $sql$;

    EXECUTE 'DROP TRIGGER IF EXISTS kitchen_ticket_realtime_broadcast ON public."KitchenTicketState"';
    EXECUTE $sql$
      CREATE TRIGGER kitchen_ticket_realtime_broadcast
      AFTER INSERT OR UPDATE OR DELETE ON public."KitchenTicketState"
      FOR EACH ROW EXECUTE FUNCTION public.broadcast_kitchen_ticket_change();
    $sql$;

    EXECUTE 'DROP POLICY IF EXISTS "active kitchen roles receive ticket broadcasts" ON realtime.messages';
    EXECUTE $sql$
      CREATE POLICY "active kitchen roles receive ticket broadcasts"
      ON realtime.messages
      FOR SELECT
      TO authenticated
      USING (
        (SELECT realtime.topic()) = 'kitchen:tickets'
        AND realtime.messages.extension = 'broadcast'
        AND (SELECT public.can_receive_kitchen_realtime())
      );
    $sql$;
  END IF;
END $$;
