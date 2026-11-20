import posthog from "posthog-js";

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
const reportExceptions =
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PUBLIC_VERCEL_TARGET_ENV === "production";

if (!projectToken || !host) {
  if (process.env.NODE_ENV === "development") {
    const missingVariable = !projectToken
      ? "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN"
      : "NEXT_PUBLIC_POSTHOG_HOST";

    throw new Error(
      `${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`,
    );
  }
} else if (typeof window !== "undefined") {
  posthog.init(projectToken, {
    api_host: host,
    defaults: "2026-01-30",
    capture_exceptions: reportExceptions,
    before_send: (event) =>
      !reportExceptions && event?.event === "$exception" ? null : event,
    tracing_headers: [window.location.hostname],
    debug: process.env.NODE_ENV === "development",
  });
}
