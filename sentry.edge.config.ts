import * as Sentry from "@sentry/nextjs";
import { sentryDataCollection } from "./src/lib/sentry-data-collection";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  dataCollection: sentryDataCollection,
});
