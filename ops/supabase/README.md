# Supplier-order scheduler cutover

These scripts move automatic supplier-order processing from GitHub's delayed
five-minute schedule to Supabase Cron. GitHub `workflow_dispatch` remains the
manual fallback. Do not disable GitHub's scheduled trigger until the Supabase
job has passed the checks below.

## Timing invariant

- Vercel route maximum: 120 seconds
- `pg_net` request timeout: 135 seconds
- database scheduler lease: 180 seconds

The lease therefore remains held for longer than Vercel can legally execute the
route, and `pg_net` stops waiting before a crashed execution's lease expires.

## 1. Deploy the lease first

Deploy the application and apply the Prisma migration that creates
`SchedulerLease`. Leave `.github/workflows/supplier-order-scheduler.yml`
scheduled every five minutes during this phase.

## 2. Install the inactive Supabase dispatcher

Run `supplier-order-cron-setup.sql` from the Supabase SQL editor. It creates the
private invocation function but does not create a cron job.

In Supabase Vault, create these two named secrets without committing their
values to the repository:

- `supplier_order_app_base_url`: the stable production Vercel URL
- `supplier_order_cron_secret`: exactly the same `CRON_SECRET` configured in Vercel

## 3. Verify a real HTTP response

Manually queue one invocation and retain the returned request ID:

```sql
SELECT private.invoke_supplier_order_scheduler() AS request_id;
```

`pg_net` is asynchronous, so wait for that statement's transaction to commit,
then query the response using the returned ID:

```sql
SELECT
  response.id,
  response.status_code,
  response.timed_out,
  response.error_msg,
  response.content::jsonb AS body
FROM net._http_response AS response
WHERE response.id = <request_id>;
```

Require HTTP 200, `timed_out = false`, a null `error_msg`, and a body containing
`"ok": true`, `"enabled": true`, and an `alreadyRunning` boolean. A succeeded
row in `cron.job_run_details` only proves that SQL queued the HTTP request.

## 4. Activate and observe

Run `supplier-order-cron-activate.sql`, then inspect at least five executions:

```sql
SELECT jobid, status, start_time, end_time, return_message
FROM cron.job_run_details
WHERE jobid = (
  SELECT jobid
  FROM cron.job
  WHERE jobname = 'supplier-order-scheduler-every-minute'
)
ORDER BY start_time DESC
LIMIT 5;
```

Match those invocations with their actual responses in `net._http_response`,
then complete a controlled invitation, employee response, purchase-order PDF,
and supplier delivery test.

## 5. Validate collision handling

In a quiet test window with no orders due, hold the production lease manually:

```sql
INSERT INTO public."SchedulerLease" (
  "key", "ownerToken", "expiresAt", "createdAt", "updatedAt"
)
VALUES (
  'supplier-order-scheduler',
  'manual-cutover-test',
  CURRENT_TIMESTAMP + INTERVAL '3 minutes',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
```

Manually dispatch the GitHub fallback and require a successful response with
`"alreadyRunning": true`. Release only the test-owned lease:

```sql
DELETE FROM public."SchedulerLease"
WHERE "key" = 'supplier-order-scheduler'
  AND "ownerToken" = 'manual-cutover-test';
```

Confirm that no duplicate WhatsApp delivery was created or sent.

## 6. Complete the cutover

After all checks pass, comment out rather than delete the GitHub workflow's
`schedule:` block. Leave a comment explaining that it previously invoked the
supplier-order scheduler every five minutes, and retain `workflow_dispatch`.
Use `supplier-order-cron-disable.sql` to stop Supabase scheduling during rollback.
