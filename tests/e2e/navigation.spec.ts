import { test, expect } from "@playwright/test";

test.describe("Main Menu Navigation Layout", () => {
  test("unauthenticated users navigating game routes should be redirected to login", async ({ page }) => {
    // Navigate directly to room builder
    await page.goto("/room");
    
    // Expect automatic redirect to /login
    await expect(page).toHaveURL(/.*\/login/);
  });
});
