-- Run only after a manual invocation has produced a verified HTTP 200 response.
-- pg_cron updates the existing job when this same case-sensitive name is reused.

WITH scheduled AS (
  SELECT cron.schedule(
    'supplier-order-scheduler-every-minute',
    '* * * * *',
    $command$SELECT private.invoke_supplier_order_scheduler();$command$
  ) AS job_id
)
SELECT cron.alter_job(job_id := scheduled.job_id, active := true)
FROM scheduled;
