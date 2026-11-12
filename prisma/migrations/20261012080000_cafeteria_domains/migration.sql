-- Apply with prisma migrate deploy as a database administrator.
-- Existing records remain in Mashallah; no staff are automatically promoted.
BEGIN;
CREATE TABLE "Cafeteria" ("id" text PRIMARY KEY, "name" text NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "CafeteriaDomain" (
  "hostname" text PRIMARY KEY, "cafeteriaId" text NOT NULL REFERENCES "Cafeteria"("id"),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("hostname" = lower("hostname") AND "hostname" !~ '[/:[:space:]]')
);
CREATE INDEX "CafeteriaDomain_cafeteriaId_idx" ON "CafeteriaDomain"("cafeteriaId");
INSERT INTO "Cafeteria" ("id", "name") VALUES ('mashallah', 'Mashallah');
ALTER TABLE "Staff" ADD COLUMN "isPlatformAdmin" boolean NOT NULL DEFAULT false;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pos_cafeteria_runtime') THEN
    CREATE ROLE pos_cafeteria_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
  EXECUTE format('GRANT pos_cafeteria_runtime TO %I', current_user);
END $$;
GRANT USAGE ON SCHEMA public TO pos_cafeteria_runtime;
CREATE FUNCTION public.pos_keep_cafeteria_ownership() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."cafeteriaId" IS DISTINCT FROM NEW."cafeteriaId" THEN
    RAISE EXCEPTION 'Cafeteria ownership cannot be changed';
  END IF;
  IF TG_TABLE_NAME = 'Staff' AND current_user = 'pos_cafeteria_runtime' THEN
    IF TG_OP = 'INSERT' AND NEW."isPlatformAdmin" THEN
      RAISE EXCEPTION 'Only platform management may grant platform access';
    ELSIF TG_OP = 'UPDATE' AND OLD."isPlatformAdmin" IS DISTINCT FROM NEW."isPlatformAdmin" THEN
      RAISE EXCEPTION 'Only platform management may grant platform access';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.pos_keep_cafeteria_ownership() FROM PUBLIC;
DO $migration$
DECLARE t text; pol record;
BEGIN
 FOREACH t IN ARRAY ARRAY['Staff','Customer','CafeSetting','EmploymentProfile','AttendancePolicy','ScheduledShift','ClockEvent','AttendanceRecord','PayrollAdjustment','PayrollRun','PayrollLine','AuditLog','ExpenseCategory','ExpenseTransaction','OwnerWithdrawal','SupplierReceiving','SupplierReceivingItem','CustomerFeedback','ComplaintCase','ReportExportAudit','Category','Product','InventorySupply','InventoryMovement','ModifierGroup','Modifier','Table','TableCheck','Order','OrderItem','InventoryUnitConversion','RecipeVersion','RecipeIngredient','StockEvent','InventoryCountSession','InventoryCountLine','SalesAdjustment','KitchenTicketState','KitchenTicketStationState','KitchenPreparationTarget','KitchenTransitionEvent','KitchenQualityEvent','OperationalIncident','CleaningChecklistTemplate','CleaningChecklistTask','CleaningChecklistRun','CleaningChecklistRunTask','OrderItemModifier','Payment','PaymentRequest','MobileMoneyReceipt','CustomerCheckout','PaymentGatewayStatus','PaymentDeferral','Shift','WaiterBalanceInitialization','Supplier','SupplierBill','SupplierPayment','SupplierPaymentAllocation','DailySalaryRate','DailyCashDay','DailyCashManualExpense','DailyCashSupplierPayment','DailyCashSupplyPayment','DailyCashSavingsDeposit','SupplierCatalogItem','SupplierPurchaseOrder','SupplierPurchaseOrderItem','SchedulerLease','SupplierOrderSchedule','SupplierOrderScheduleRecipient','SupplierOrderRun','SupplierOrderRunRecipient','SupplierOrderResponseItem','SupplierOrderWhatsAppDelivery','SupplierInvoice','SupplierInvoiceRecurrence','SupplierInvoiceRecurrenceItem','SupplierInvoiceInstallment','SupplierInvoiceItem','SupplyCatalogItem','SupplyDay','SupplyPurchase'] LOOP
  IF to_regclass(format('public.%I',t)) IS NULL THEN CONTINUE; END IF;
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN "cafeteriaId" text',t);
  EXECUTE format('UPDATE public.%I SET "cafeteriaId" = ''mashallah''',t);
  EXECUTE format('ALTER TABLE public.%I ALTER COLUMN "cafeteriaId" SET NOT NULL',t);
  EXECUTE format('ALTER TABLE public.%I ALTER COLUMN "cafeteriaId" SET DEFAULT current_setting(''app.cafeteria_id'', true)',t);
  EXECUTE format('ALTER TABLE public.%I ADD FOREIGN KEY ("cafeteriaId") REFERENCES public."Cafeteria"("id")',t);
  EXECUTE format('CREATE INDEX %I ON public.%I ("cafeteriaId")',t || '_cafeteriaId_idx',t);
  EXECUTE format('CREATE TRIGGER pos_ownership BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.pos_keep_cafeteria_ownership()',t);
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
    EXECUTE format('DROP POLICY %I ON public.%I',pol.policyname,t);
  END LOOP;
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY pos_cafeteria_scope ON public.%I TO pos_cafeteria_runtime USING ("cafeteriaId" = current_setting(''app.cafeteria_id'', true)) WITH CHECK ("cafeteriaId" = current_setting(''app.cafeteria_id'', true))',t);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO pos_cafeteria_runtime',t);
  IF EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN EXECUTE format('REVOKE ALL ON public.%I FROM anon',t); END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE format('REVOKE ALL ON public.%I FROM authenticated',t); END IF;
 END LOOP;
END $migration$;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pos_cafeteria_runtime;
ALTER TABLE "Cafeteria" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CafeteriaDomain" ENABLE ROW LEVEL SECURITY;
UPDATE "CafeSetting" SET "id" = 'mashallah:' || "id";
UPDATE "AttendancePolicy" SET "id" = 'mashallah:' || "id";
UPDATE "PaymentGatewayStatus" SET "id" = 'mashallah:' || "id";
UPDATE "SchedulerLease" SET "key" = 'mashallah:' || "key";
-- Natural unique keys become cafeteria-local; globally unique primary IDs stay.
DO $indexes$
DECLARE r record; cols text;
BEGIN
 FOR r IN
  SELECT i.indexrelid,i.indrelid,c.relname AS index_name,t.relname AS table_name,i.indkey
  FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_class t ON t.oid=i.indrelid
  JOIN pg_namespace n ON n.oid=t.relnamespace
  WHERE n.nspname='public' AND i.indisunique AND NOT i.indisprimary
   AND t.relname NOT IN ('Cafeteria','CafeteriaDomain','_prisma_migrations')
   AND EXISTS (SELECT FROM pg_attribute a WHERE a.attrelid=t.oid AND a.attname='cafeteriaId')
 LOOP
  SELECT string_agg(quote_ident(a.attname),', ' ORDER BY k.ordinality) INTO cols
  FROM unnest(r.indkey) WITH ORDINALITY k(attnum,ordinality)
  JOIN pg_attribute a ON a.attrelid=r.indrelid AND a.attnum=k.attnum;
  EXECUTE format('DROP INDEX public.%I',r.index_name);
  EXECUTE format('CREATE UNIQUE INDEX %I ON public.%I ("cafeteriaId", %s)',r.index_name,r.table_name,cols);
 END LOOP;
END $indexes$;
-- Tenant-qualified foreign keys prevent cross-cafeteria nested associations.
DO $foreign_keys$
DECLARE r record; child_cols text; parent_cols text; ix text;
BEGIN
 FOR r IN SELECT c.*,t.relname AS child_table,p.relname AS parent_table
  FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_class p ON p.oid=c.confrelid
  JOIN pg_namespace n ON n.oid=t.relnamespace
  WHERE c.contype='f' AND n.nspname='public'
   AND EXISTS (SELECT FROM pg_attribute a WHERE a.attrelid=t.oid AND a.attname='cafeteriaId')
   AND EXISTS (SELECT FROM pg_attribute a WHERE a.attrelid=p.oid AND a.attname='cafeteriaId')
 LOOP
  SELECT string_agg(quote_ident(a.attname),', ' ORDER BY k.ordinality) INTO child_cols
  FROM unnest(r.conkey) WITH ORDINALITY k(attnum,ordinality) JOIN pg_attribute a ON a.attrelid=r.conrelid AND a.attnum=k.attnum;
  SELECT string_agg(quote_ident(a.attname),', ' ORDER BY k.ordinality) INTO parent_cols
  FROM unnest(r.confkey) WITH ORDINALITY k(attnum,ordinality) JOIN pg_attribute a ON a.attrelid=r.confrelid AND a.attnum=k.attnum;
  ix := 'pos_ref_' || r.oid::text;
  EXECUTE format('CREATE UNIQUE INDEX %I ON public.%I ("cafeteriaId", %s)',ix,r.parent_table,parent_cols);
  EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY ("cafeteriaId", %s) REFERENCES public.%I ("cafeteriaId", %s) DEFERRABLE INITIALLY DEFERRED',r.child_table,ix,child_cols,r.parent_table,parent_cols);
 END LOOP;
END $foreign_keys$;
-- Retire shared broadcasts: each cafeteria receives its own private topic.
DO $realtime$
BEGIN
 IF to_regclass('realtime.messages') IS NOT NULL AND to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NOT NULL THEN
  CREATE SCHEMA IF NOT EXISTS pos_private;
  EXECUTE $fn$
   CREATE OR REPLACE FUNCTION pos_private.can_receive_cafeteria_topic() RETURNS boolean
   LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $body$
    SELECT EXISTS (
     SELECT 1 FROM public."Staff" s JOIN public."Cafeteria" c ON c."id" = s."cafeteriaId"
     WHERE s."id" = (SELECT auth.uid())::text AND s."isActive" AND c."isActive"
      AND (SELECT realtime.topic()) IN (
       'cafeteria:' || s."cafeteriaId" || ':kitchen:tickets',
       'cafeteria:' || s."cafeteriaId" || ':report-invalidations'
      )
    )
   $body$
  $fn$;
  REVOKE ALL ON FUNCTION pos_private.can_receive_cafeteria_topic() FROM PUBLIC;
  GRANT USAGE ON SCHEMA pos_private TO authenticated;
  GRANT EXECUTE ON FUNCTION pos_private.can_receive_cafeteria_topic() TO authenticated;
  -- Restrictive policy prevents older permissive policies from reopening shared topics.
  EXECUTE 'CREATE POLICY pos_cafeteria_realtime_guard ON realtime.messages AS RESTRICTIVE FOR SELECT TO authenticated USING ((SELECT pos_private.can_receive_cafeteria_topic()))';
  EXECUTE 'CREATE POLICY pos_cafeteria_realtime_receive ON realtime.messages FOR SELECT TO authenticated USING (extension = ''broadcast'' AND (SELECT pos_private.can_receive_cafeteria_topic()))';
  EXECUTE $fn$
   CREATE OR REPLACE FUNCTION public.broadcast_kitchen_ticket_change() RETURNS trigger
   LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $body$
   BEGIN
    PERFORM realtime.send(
     pg_catalog.jsonb_build_object('orderId', COALESCE(NEW."orderId", OLD."orderId"), 'operation', TG_OP),
     'ticket_changed',
     'cafeteria:' || COALESCE(NEW."cafeteriaId", OLD."cafeteriaId") || ':kitchen:tickets', true
    );
    RETURN COALESCE(NEW, OLD);
   END $body$
  $fn$;
  REVOKE ALL ON FUNCTION public.broadcast_kitchen_ticket_change() FROM PUBLIC;
 END IF;
END $realtime$;
COMMIT;
