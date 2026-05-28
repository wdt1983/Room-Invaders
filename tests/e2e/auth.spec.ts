import { test, expect } from "@playwright/test";

test.describe("Authentication Page Flow", () => {
  test("should display marketing dashboard and CTAs on landing page", async ({ page }) => {
    await page.goto("/");
    
    // Verify brand header is present
    await expect(page.locator("header")).toContainText("ROOM INVADERS");
    
    // Verify main H1 headers are visible
    await expect(page.locator("h1")).toContainText("YOUR BEDROOM");
    await expect(page.locator("h1")).toContainText("YOUR STRONGHOLD");
    
    // Verify PWA installation status or subtitle is visible
    await expect(page.locator("body")).toContainText("PWA Version");
    
    // Verify Enter Stronghold / Claim Room Coordinates badges are visible
    const enterButton = page.locator("a", { hasText: "Enter Stronghold" });
    await expect(enterButton).toBeVisible();
    
    const claimButton = page.locator("a", { hasText: "Claim Room Coordinates" });
    await expect(claimButton).toBeVisible();
  });

  test("should render register cards and forms correctly", async ({ page }) => {
    await page.goto("/register");
    
    // Verify card titles and descriptions
    await expect(page.locator("main")).toContainText("Create an account");
    await expect(page.locator("main")).toContainText("Join Room Invaders");
    
    // Verify inputs are present
    await expect(page.locator("input[name='username']")).toBeVisible();
    await expect(page.locator("input[placeholder='invader42']")).toBeVisible();
    await expect(page.locator("input[name='email']")).toBeVisible();
    await expect(page.locator("input[placeholder='you@example.com']")).toBeVisible();
    await expect(page.locator("input[name='password']")).toBeVisible();
    
    // Verify submit button
    await expect(page.locator("button[type='submit']")).toContainText("Create Account");
  });

  test("should render login form correctly", async ({ page }) => {
    await page.goto("/login");
    
    // Verify card titles and descriptions
    await expect(page.locator("main")).toContainText("Welcome back");
    await expect(page.locator("main")).toContainText("Sign in to your Room Invaders account");
    
    // Verify inputs are present
    await expect(page.locator("input[name='email']")).toBeVisible();
    await expect(page.locator("input[placeholder='you@example.com']")).toBeVisible();
    await expect(page.locator("input[name='password']")).toBeVisible();
    
    // Verify submit button
    await expect(page.locator("button[type='submit']")).toContainText("Sign In");
  });
});
