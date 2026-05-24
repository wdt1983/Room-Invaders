"use client";

import { useEffect } from "react";

/**
 * Registers the service worker on mount.
 * Placed in the root layout so it runs once on app load.
 * Only registers in production or when explicitly enabled.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("[SW] Registered:", registration.scope);
        })
        .catch((error) => {
          console.error("[SW] Registration failed:", error);
        });
    }
  }, []);

  return null;
}
