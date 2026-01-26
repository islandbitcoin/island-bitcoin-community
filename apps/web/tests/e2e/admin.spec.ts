import { test, expect } from "@playwright/test";

test.describe("Admin Panel Access", () => {
  test("admin page loads", async ({ page }) => {
    const response = await page.goto("/admin");
    expect(response?.status()).toBe(200);
  });

  test("admin page serves HTML", async ({ page }) => {
    await page.goto("/admin");
    const html = await page.content();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('<div id="root">');
  });
});

test.describe("Admin Setup Flow", () => {
  test("admin setup page loads", async ({ page }) => {
    const response = await page.goto("/admin-setup");
    expect(response?.status()).toBe(200);
  });

  test("admin setup page serves HTML", async ({ page }) => {
    await page.goto("/admin-setup");
    const html = await page.content();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('<div id="root">');
  });
});
