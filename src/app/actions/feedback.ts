/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createClient } from "@/lib/supabase/server";
import * as Sentry from "@sentry/nextjs";
import { trackEvent } from "@/lib/game/analytics";

export interface FeedbackPayload {
  category: string;
  ratingGameplay: number;
  ratingVisuals: number;
  ratingPerformance: number;
  comments: string;
  metadata?: Record<string, any>;
}

/**
 * Server Action: submitBetaFeedback
 * Commits a tester's feedback report transactionally to the database,
 * dispatches console/telemetry events, and notifies the developer Sentry dashboard.
 */
export async function submitBetaFeedback(payload: FeedbackPayload) {
  return await Sentry.withServerActionInstrumentation("submitBetaFeedback", {}, async () => {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Unauthorized: Tester session not found.");
      }

      // Input validation
      if (!payload.category || !payload.comments) {
        throw new Error("Missing required feedback parameters.");
      }

      const ratingGameplay = Math.max(1, Math.min(5, payload.ratingGameplay));
      const ratingVisuals = Math.max(1, Math.min(5, payload.ratingVisuals));
      const ratingPerformance = Math.max(1, Math.min(5, payload.ratingPerformance));

      // Construct metadata including user environment context
      const fullMetadata = {
        ...(payload.metadata || {}),
        playerLevel: payload.metadata?.playerLevel || 1,
        activePath: payload.metadata?.activePath || "/",
        clientTimestamp: new Date().toISOString(),
      };

      // Insert into PostgreSQL beta_feedback table
      const { error } = await (supabase as any).from("beta_feedback").insert({
        user_id: user.id,
        category: payload.category,
        rating_gameplay: ratingGameplay,
        rating_visuals: ratingVisuals,
        rating_performance: ratingPerformance,
        comments: payload.comments,
        metadata: fullMetadata,
      });

      if (error) {
        console.error("Database insert failed for beta feedback:", error);
        throw new Error(`Database failure: ${error.message}`);
      }

      // Telemetry capture: Log event inside Sentry for operations center dashboard alerts
      trackEvent("beta_feedback_submitted" as any, {
        userId: user.id,
        category: payload.category,
        ratingGameplay,
        ratingVisuals,
        ratingPerformance,
        activePath: fullMetadata.activePath,
      });

      Sentry.captureMessage(`[Beta Feedback] ${payload.category.toUpperCase()} report submitted by user ${user.id}`, {
        level: "info",
        extra: {
          category: payload.category,
          ratings: { gameplay: ratingGameplay, visuals: ratingVisuals, performance: ratingPerformance },
          comments: payload.comments,
          metadata: fullMetadata,
        },
      });

      return { success: true, message: "Feedback report transmitted successfully." };
    } catch (err: any) {
      console.error("Exception in submitBetaFeedback Server Action:", err);
      Sentry.captureException(err);
      return { success: false, error: err.message || "An unknown transmission failure occurred." };
    }
  });
}
