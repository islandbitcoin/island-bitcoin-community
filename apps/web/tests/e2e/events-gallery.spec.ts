import { test, expect } from "@playwright/test";

test.describe("Events Page", () => {
  test("events page loads", async ({ page }) => {
    const response = await page.goto("/events");
    expect(response?.status()).toBe(200);
  });

  test("events page serves HTML", async ({ page }) => {
    await page.goto("/events");
    const html = await page.content();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('<div id="root">');
  });
});

test.describe("Gallery Page", () => {
  test("gallery page loads", async ({ page }) => {
    const response = await page.goto("/gallery");
    expect(response?.status()).toBe(200);
  });

  test("gallery page serves HTML", async ({ page }) => {
    await page.goto("/gallery");
    const html = await page.content();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('<div id="root">');
  });
});

test.describe("Events and Gallery Navigation", () => {
  test("can navigate to events page", async ({ page }) => {
    const response = await page.goto("/events");
    expect(response?.status()).toBe(200);
  });

  test("can navigate to gallery page", async ({ page }) => {
    const response = await page.goto("/gallery");
    expect(response?.status()).toBe(200);
  });

  test("homepage serves valid HTML", async ({ page }) => {
    await page.goto("/");
    const html = await page.content();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('<div id="root">');
  });
});
