import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  org: "alt-games",
  project: "room-invaders",
  silent: true, // Suppresses all logs
  widenClientFileUpload: true,
});
