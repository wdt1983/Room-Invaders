"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { trackEvent } from "@/lib/game/analytics";

/**
 * Server Action: Log in with email and password.
 * Redirects to /room on success, /login?error=[message] on failure.
 */
export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/room");
}

/**
 * Server Action: Register a new account with email, password, and username.
 * Passes username into auth metadata via options.data.username.
 * Redirects to /login?message=Check your email on success,
 * /register?error=[message] on failure.
 */
export async function signup(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const username = formData.get("username") as string;

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
      },
    },
  });

  if (error) {
    redirect(`/register?error=${encodeURIComponent(error.message)}`);
  }

  // Track the successful registration event
  trackEvent("registration", { email, username });

  redirect("/login?message=Check your email");
}

/**
 * Server Action: Sign out the current user.
 * Redirects to /login after signing out.
 */
export async function logout() {
  const supabase = await createClient();

  await supabase.auth.signOut();

  redirect("/login");
}
