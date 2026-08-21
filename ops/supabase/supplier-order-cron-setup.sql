-- Run once in the production Supabase SQL editor before activating the job.
-- This script is intentionally inactive: it installs the dispatcher only.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

CREATE SCHEMA IF NOT EXISTS private AUTHORIZATION postgres;
ALTER SCHEMA private OWNER TO postgres;

CREATE OR REPLACE FUNCTION private.invoke_supplier_order_scheduler()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  app_base_url TEXT;
  cron_secret TEXT;
  request_id BIGINT;
BEGIN
  SELECT pg_catalog.btrim(secret.decrypted_secret)
  INTO app_base_url
  FROM vault.decrypted_secrets AS secret
  WHERE secret.name = 'supplier_order_app_base_url'
  LIMIT 1;

  SELECT pg_catalog.btrim(secret.decrypted_secret)
  INTO cron_secret
  FROM vault.decrypted_secrets AS secret
  WHERE secret.name = 'supplier_order_cron_secret'
  LIMIT 1;

  IF app_base_url IS NULL OR app_base_url = '' THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Required supplier-order application URL is not configured in Vault.';
  END IF;
  IF cron_secret IS NULL OR cron_secret = '' THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Required supplier-order cron credential is not configured in Vault.';
  END IF;

  app_base_url := pg_catalog.regexp_replace(app_base_url, '/+$', '');
  IF app_base_url !~ '^https://[^[:space:]]+$' THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Supplier-order application URL must be an HTTPS URL.';
  END IF;

  SELECT net.http_get(
    url := app_base_url || '/api/cron/supplier-order-schedules',
    headers := pg_catalog.jsonb_build_object(
      'Authorization', 'Bearer ' || cron_secret,
      'User-Agent', 'supabase-cron/supplier-order-scheduler'
    ),
    timeout_milliseconds := 135000
  )
  INTO request_id;

  RETURN request_id;
END;
$function$;

ALTER FUNCTION private.invoke_supplier_order_scheduler() OWNER TO postgres;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
REVOKE ALL ON SCHEMA private FROM authenticated;
REVOKE ALL ON FUNCTION private.invoke_supplier_order_scheduler() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.invoke_supplier_order_scheduler() FROM anon;
REVOKE ALL ON FUNCTION private.invoke_supplier_order_scheduler() FROM authenticated;
