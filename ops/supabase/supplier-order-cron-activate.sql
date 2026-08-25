-- Run only after a manual invocation has produced a verified HTTP 200 response.
-- The canonical job runs twice per hour. Reusing its case-sensitive name updates it.

BEGIN;

-- Retire the previous cadence so only the canonical dispatcher remains active.
SELECT cron.unschedule(job.jobid)
FROM cron.job AS job
WHERE job.jobname = 'supplier-order-scheduler-every-minute';

WITH scheduled AS (
  SELECT cron.schedule(
    'supplier-order-scheduler-every-30-minutes',
    '*/30 * * * *',
    $command$SELECT private.invoke_supplier_order_scheduler();$command$
  ) AS job_id
)
SELECT cron.alter_job(job_id := scheduled.job_id, active := true)
FROM scheduled;

COMMIT;