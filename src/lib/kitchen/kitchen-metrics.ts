export type KitchenMetricEvent = {
  type: "STATION_CREATED" | "STATION_STARTED" | "STATION_COMPLETED" | "STATION_REOPENED";
  occurredAt: Date;
  targetMinutesSnapshot: number | null;
};

export type KitchenPreparationMetric = {
  startedAt: Date | null;
  completedAt: Date | null;
  preparationSeconds: number | null;
  targetMinutes: number | null;
  isLate: boolean | null;
  coverage: "COMPLETE" | "IN_PROGRESS" | "UNAVAILABLE";
};

export function calculateKitchenPreparationMetric(
  events: readonly KitchenMetricEvent[],
  now = new Date(),
): KitchenPreparationMetric {
  const ordered = [...events].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
  );
  const started = ordered.find((event) => event.type === "STATION_STARTED") ?? null;
  const finalEvent = started ? ordered.at(-1) ?? null : null;
  const completed =
    finalEvent?.type === "STATION_COMPLETED" ? finalEvent : null;
  const targetMinutes =
    started?.targetMinutesSnapshot ??
    ordered.find((event) => event.targetMinutesSnapshot != null)
      ?.targetMinutesSnapshot ??
    null;

  if (!started) {
    return {
      startedAt: null,
      completedAt: null,
      preparationSeconds: null,
      targetMinutes,
      isLate: null,
      coverage: "UNAVAILABLE",
    };
  }

  const end = completed?.occurredAt ?? now;
  const preparationSeconds = Math.max(
    0,
    Math.floor((end.getTime() - started.occurredAt.getTime()) / 1000),
  );
  return {
    startedAt: started.occurredAt,
    completedAt: completed?.occurredAt ?? null,
    preparationSeconds,
    targetMinutes,
    isLate:
      targetMinutes == null
        ? null
        : preparationSeconds > targetMinutes * 60,
    coverage: completed ? "COMPLETE" : "IN_PROGRESS",
  };
}

export function formatPreparationDuration(seconds: number | null) {
  if (seconds == null) return "Unavailable";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

export function canCompleteCleaningRun(
  tasks: readonly { isRequired: boolean; completed: boolean }[],
) {
  return tasks.length > 0 && tasks.every((task) => !task.isRequired || task.completed);
}

export function calculateIncidentDurationSeconds(
  startedAt: Date,
  resolvedAt: Date | null,
  now = new Date(),
) {
  return Math.max(0, Math.floor(((resolvedAt ?? now).getTime() - startedAt.getTime()) / 1000));
}

export function isCleaningRunOverdue(
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "MISSED",
  scheduledFor: Date,
  now = new Date(),
) {
  return status !== "COMPLETED" && status !== "MISSED" && scheduledFor < now;
}
