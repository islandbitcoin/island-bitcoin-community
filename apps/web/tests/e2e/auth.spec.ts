import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test("homepage loads successfully", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
  });

  test("homepage serves HTML content", async ({ page }) => {
    await page.goto("/");
    const content = await page.content();
    expect(content).toContain("<!DOCTYPE html>");
    expect(content).toContain('<div id="root">');
  });

  test("can navigate to about page", async ({ page }) => {
    const response = await page.goto("/about");
    expect(response?.status()).toBe(200);
  });

  test("can navigate to settings page", async ({ page }) => {
    const response = await page.goto("/settings");
    expect(response?.status()).toBe(200);
  });

  test("health page loads", async ({ page }) => {
    const response = await page.goto("/health");
    expect(response?.status()).toBe(200);
  });

  test("404 page loads for unknown routes", async ({ page }) => {
    const response = await page.goto("/nonexistent-page-12345");
    expect(response?.status()).toBe(200);
  });

  test("events page loads", async ({ page }) => {
    const response = await page.goto("/events");
    expect(response?.status()).toBe(200);
  });

  test("gallery page loads", async ({ page }) => {
    const response = await page.goto("/gallery");
    expect(response?.status()).toBe(200);
  });

  test("admin page loads", async ({ page }) => {
    const response = await page.goto("/admin");
    expect(response?.status()).toBe(200);
  });

  test("admin-setup page loads", async ({ page }) => {
    const response = await page.goto("/admin-setup");
    expect(response?.status()).toBe(200);
  });
});
