-- Disable the automatic dispatcher without deleting its job configuration.

SELECT cron.alter_job(job_id := job.jobid, active := false)
FROM cron.job AS job
WHERE job.jobname = 'supplier-order-scheduler-every-minute';
