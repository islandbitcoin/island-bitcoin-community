import { test, expect } from "@playwright/test";

test.describe("Bitcoin Trivia Game Flow", () => {
  test("homepage loads successfully", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
  });

  test("homepage serves valid HTML", async ({ page }) => {
    await page.goto("/");
    const html = await page.content();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('<div id="root">');
  });
});

test.describe("Game Wallet Integration", () => {
  test("homepage serves HTML with root element", async ({ page }) => {
    await page.goto("/");
    const html = await page.content();
    expect(html).toContain('<div id="root">');
  });
});
