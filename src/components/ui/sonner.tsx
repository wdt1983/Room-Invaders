"use client";

import type { CSSProperties } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Shadcn-style themed wrapper around sonner's Toaster.
 *
 * Sonner 2.x reads a set of CSS custom properties (`--normal-bg`,
 * `--normal-text`, `--normal-border`, …) at render time. Binding them to
 * the project's shadcn palette (`--popover`, `--popover-foreground`,
 * `--border`) means toast surfaces match the rest of the UI
 * automatically in both light and dark modes without a separate
 * `next-themes` integration.
 */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
