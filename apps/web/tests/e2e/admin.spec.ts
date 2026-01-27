import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mockAdminConfig = {
  maxDailyPayout: "10000",
  maxPayoutPerUser: "5000",
  minWithdrawal: "100",
  withdrawalFee: "0",
  triviaEasy: "10",
  triviaMedium: "25",
  triviaHard: "50",
  dailyChallenge: "100",
  achievementBonus: "50",
  referralBonus: "100",
  triviaPerHour: "10",
  withdrawalsPerDay: "5",
  maxStreakBonus: "500",
  adminPubkeys: '["test-pubkey-123"]',
  maintenanceMode: "false",
  satoshiStacker: "true",
  autoApprove: "false",
  autoApproveThreshold: "100",
};

const MOCK_ADMIN_PUBKEY = "test-pubkey-123";

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

test.describe("Admin Tabs - Tab Structure Verification", () => {
  test("all 7 tabs are defined in Admin.tsx source code", () => {
    const adminTsxPath = path.resolve(__dirname, "../../src/pages/Admin.tsx");
    const adminContent = fs.readFileSync(adminTsxPath, "utf-8");
    
    const tabs = ["rewards", "limits", "payouts", "btcpay", "admins", "games", "events"];
    for (const tab of tabs) {
      expect(adminContent).toContain(`value="${tab}"`);
    }
  });

  test("Rewards tab has required form elements", () => {
    const adminTsxPath = path.resolve(__dirname, "../../src/pages/Admin.tsx");
    const adminContent = fs.readFileSync(adminTsxPath, "utf-8");
    
    expect(adminContent).toContain('id="trivia-easy"');
    expect(adminContent).toContain('id="trivia-medium"');
    expect(adminContent).toContain('id="trivia-hard"');
    expect(adminContent).toContain('id="daily-challenge"');
    expect(adminContent).toContain('id="achievement-bonus"');
    expect(adminContent).toContain('id="referral-bonus"');
  });

  test("Limits tab has required form elements", () => {
    const adminTsxPath = path.resolve(__dirname, "../../src/pages/Admin.tsx");
    const adminContent = fs.readFileSync(adminTsxPath, "utf-8");
    
    expect(adminContent).toContain('id="trivia-limit"');
    expect(adminContent).toContain('id="max-daily"');
    expect(adminContent).toContain('id="max-user"');
    expect(adminContent).toContain('id="min-withdrawal"');
  });

  test("Payouts tab exists in Admin.tsx", () => {
    const adminTsxPath = path.resolve(__dirname, "../../src/pages/Admin.tsx");
    const adminContent = fs.readFileSync(adminTsxPath, "utf-8");
    
    expect(adminContent).toContain('value="payouts"');
    expect(adminContent).toContain("PayoutsTable");
  });

  test("Pull Payments (btcpay) tab exists in Admin.tsx", () => {
    const adminTsxPath = path.resolve(__dirname, "../../src/pages/Admin.tsx");
    const adminContent = fs.readFileSync(adminTsxPath, "utf-8");
    
    expect(adminContent).toContain('value="btcpay"');
    expect(adminContent).toContain("Flash API");
  });

  test("Admins tab exists in Admin.tsx", () => {
    const adminTsxPath = path.resolve(__dirname, "../../src/pages/Admin.tsx");
    const adminContent = fs.readFileSync(adminTsxPath, "utf-8");
    
    expect(adminContent).toContain('value="admins"');
    expect(adminContent).toContain("Admin Management");
  });

  test("Games tab exists in Admin.tsx", () => {
    const adminTsxPath = path.resolve(__dirname, "../../src/pages/Admin.tsx");
    const adminContent = fs.readFileSync(adminTsxPath, "utf-8");
    
    expect(adminContent).toContain('value="games"');
    expect(adminContent).toContain("Game Management");
  });

  test("Events tab exists with NIP-07 support in Admin.tsx", () => {
    const adminTsxPath = path.resolve(__dirname, "../../src/pages/Admin.tsx");
    const adminContent = fs.readFileSync(adminTsxPath, "utf-8");
    
    expect(adminContent).toContain('value="events"');
    expect(adminContent).toContain("EventsTab");
    expect(adminContent).toContain("Publish Calendar Event");
    expect(adminContent).toContain('id="event-title"');
    expect(adminContent).toContain('id="event-description"');
    expect(adminContent).toContain('id="event-start"');
    expect(adminContent).toContain('id="event-end"');
    expect(adminContent).toContain('id="event-location"');
    expect(adminContent).toContain("NIP-07");
  });

  test("Events tab has window.nostr mock support", () => {
    const adminTsxPath = path.resolve(__dirname, "../../src/pages/Admin.tsx");
    const adminContent = fs.readFileSync(adminTsxPath, "utf-8");
    
    expect(adminContent).toContain("window.nostr");
    expect(adminContent).toContain("signEvent");
  });
});

test.describe("Admin Tabs - Runtime Rendering", () => {
  test("admin page loads successfully", async ({ page }) => {
    const response = await page.goto("/admin");
    expect(response?.status()).toBe(200);
  });

  test("admin page serves HTML with root element", async ({ page }) => {
    await page.goto("/admin");
    const html = await page.content();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('<div id="root">');
  });
});
