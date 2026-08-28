-- Disable the automatic dispatcher without deleting its job configuration.

SELECT cron.alter_job(job_id := job.jobid, active := false)
FROM cron.job AS job
WHERE job.jobname IN (
  'supplier-order-scheduler-every-30-minutes',
  'supplier-order-scheduler-every-minute'
);