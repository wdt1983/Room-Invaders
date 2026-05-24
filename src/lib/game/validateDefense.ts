import { createClient } from "@/lib/supabase/client";

/**
 * Client wrapper around the `validate-defense` Edge Function (task 2.0.9).
 *
 * Calls the server-side layout verification endpoint, which securely loads the
 * placed items for the authenticated user and validates them against all structural,
 * perimeter, overlap, slot-capacity, and research lock bounds.
 *
 * If the layout is valid, the server recomputes the defense rating and persists it,
 * returning the fresh rating.
 */

export interface ValidateDefenseResponse {
  success: true;
  valid: boolean;
  defenseRating: number;
  defenseSlotsUsed: number;
  defenseSlotsCap: number;
  errors: string[];
}

export interface ValidateDefenseError {
  success: false;
  error: string;
}

export async function validateDefense(): Promise<ValidateDefenseResponse | ValidateDefenseError | null> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase.functions.invoke<
      ValidateDefenseResponse | ValidateDefenseError
    >("validate-defense", { method: "POST", body: {} });

    if (error) {
      console.warn("[validateDefense] Edge Function invoke error:", error);
      // deno-lint-ignore no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctx: Response | undefined = (error as any)?.context;
      if (ctx && typeof ctx.text === "function") {
        try {
          const body = await ctx.clone().text();
          console.warn(
            "[validateDefense] Server response:",
            ctx.status,
            ctx.statusText,
            body,
          );
        } catch (readErr) {
          console.warn("[validateDefense] Failed reading error body:", readErr);
        }
      }
      return null;
    }
    return data ?? null;
  } catch (err) {
    console.warn("[validateDefense] Unexpected error calling edge function:", err);
    return null;
  }
}
