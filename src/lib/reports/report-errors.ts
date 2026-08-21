import { Prisma } from "@prisma/client";

export const REPORT_SCHEMA_NOT_READY_MESSAGE =
  "Reporting is not ready on this database. Apply the pending Prisma migrations to the intended development or staging database, then restart the application.";

export function isReportSchemaNotReady(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2022"
  );
}
