import Link from "next/link";
import { login } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/**
 * Login page — Server Component.
 * Parses URL searchParams to display error or success messages.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>
            Sign in to your Room Invaders account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {params.error && (
            <div
              id="login-error"
              className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {params.error}
            </div>
          )}
          {params.message && (
            <div
              id="login-message"
              className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary"
            >
              {params.message}
            </div>
          )}
          <form action={login} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
              />
            </div>
            <Button id="login-submit" type="submit" className="mt-2 w-full">
              Sign In
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="text-primary underline underline-offset-4 hover:text-primary/80"
            >
              Register
            </Link>
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}
