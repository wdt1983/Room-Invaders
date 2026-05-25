import * as Sentry from "@sentry/nextjs";

/**
 * Lightweight, offline-compliant, zero-dependency game telemetry system.
 * Logs events locally to console in development and records them
 * to Sentry in production using custom tags, breadcrumbs, and extra context.
 */
export function trackEvent(name: string, data?: Record<string, any>) {
  if (process.env.NODE_ENV === "development") {
    console.log(`[Telemetry Event] ${name}:`, JSON.stringify(data || {}, null, 2));
  }

  // Record as a Sentry breadcrumb for deep context in error cascades
  Sentry.addBreadcrumb({
    category: "game_telemetry",
    message: `Event fired: ${name}`,
    data: data,
    level: "info",
  });

  // Capture as a distinct event with searchable tags for analytics dashboards
  Sentry.captureMessage(`Telemetry: ${name}`, {
    level: "info",
    tags: {
      event_name: name,
      ...(data
        ? Object.entries(data).reduce((acc, [key, val]) => {
            if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
              acc[key] = String(val);
            }
            return acc;
          }, {} as Record<string, string>)
        : {}),
    },
    extra: data,
  });
}
