import { PostHog } from "posthog-node";

let _client: PostHog | null = null;

export function getPostHogClient(): PostHog | null {
  const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (!projectToken || !host) {
    if (process.env.NODE_ENV === "development") {
      const missingVariable = !projectToken
        ? "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN"
        : "NEXT_PUBLIC_POSTHOG_HOST";

      console.error(
        `${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`,
      );
    }
    return null;
  }

  if (!_client) {
    // Vercel's runtime region distinguishes deployed code from local builds.
    const reportExceptions =
      process.env.NODE_ENV === "production" &&
      process.env.VERCEL_TARGET_ENV === "production" &&
      Boolean(process.env.VERCEL_REGION);

    _client = new PostHog(projectToken, {
      host,
      flushAt: 1,
      flushInterval: 0,
      enableExceptionAutocapture: reportExceptions,
      before_send: (event) =>
        !reportExceptions && event?.event === "$exception" ? null : event,
    });
  }

  return _client;
}
