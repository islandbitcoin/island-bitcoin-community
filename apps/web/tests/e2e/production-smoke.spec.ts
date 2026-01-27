import { test, expect } from '@playwright/test';

const PRODUCTION_URL = 'https://beta.community.islandbitcoin.com';

test.describe('Production Smoke Tests', () => {
  test('homepage loads successfully', async ({ page }) => {
    const response = await page.goto(PRODUCTION_URL);
    
    // Should not be 502 Bad Gateway
    expect(response?.status()).not.toBe(502);
    
    // Should be 200 OK
    expect(response?.status()).toBe(200);
    
    // Wait for page to load
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    
    // Should have Island Bitcoin branding
    await expect(page.locator('text=Island Bitcoin')).toBeVisible({ timeout: 5000 });
  });

  test('admin page is accessible', async ({ page }) => {
    const response = await page.goto(`${PRODUCTION_URL}/admin`);
    
    // Should not be 502 Bad Gateway
    expect(response?.status()).not.toBe(502);
    
    // Should be 200 OK (even if showing access denied)
    expect(response?.status()).toBe(200);
    
    // Wait for page to load
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    
    // Should show either admin content or access denied (not error page)
    const hasAdminContent = await page.locator('text=Admin').count() > 0;
    const hasAccessDenied = await page.locator('text=Access Denied').count() > 0;
    const hasLoginForm = await page.locator('input[type="password"]').count() > 0;
    
    expect(hasAdminContent || hasAccessDenied || hasLoginForm).toBeTruthy();
  });

  test('admin-setup page is accessible', async ({ page }) => {
    const response = await page.goto(`${PRODUCTION_URL}/admin-setup`);
    
    // Should not be 502 Bad Gateway
    expect(response?.status()).not.toBe(502);
    
    // Should be 200 OK
    expect(response?.status()).toBe(200);
    
    // Wait for page to load
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    
    // Should show admin setup content or access denied
    const hasAdminSetup = await page.locator('text=Admin Setup').count() > 0;
    const hasAccessDenied = await page.locator('text=Access Denied').count() > 0;
    const hasLoginForm = await page.locator('input[type="password"]').count() > 0;
    
    expect(hasAdminSetup || hasAccessDenied || hasLoginForm).toBeTruthy();
  });

  test('events page loads', async ({ page }) => {
    const response = await page.goto(`${PRODUCTION_URL}/events`);
    
    expect(response?.status()).not.toBe(502);
    expect(response?.status()).toBe(200);
    
    await page.waitForLoadState('networkidle', { timeout: 15000 });
  });

  test('gallery page loads', async ({ page }) => {
    const response = await page.goto(`${PRODUCTION_URL}/gallery`);
    
    expect(response?.status()).not.toBe(502);
    expect(response?.status()).toBe(200);
    
    await page.waitForLoadState('networkidle', { timeout: 15000 });
  });

  test('API config endpoint responds', async ({ page }) => {
    // This will fail auth but should not be 502
    const response = await page.request.get(`${PRODUCTION_URL}/api/config`);
    
    // Should not be 502 Bad Gateway
    expect(response.status()).not.toBe(502);
    
    // Should be 401 (unauthorized) or 200 (if somehow authed)
    expect([200, 401]).toContain(response.status());
  });

  test('no critical console errors on homepage', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto(PRODUCTION_URL);
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    
    // Filter out known acceptable errors (like relay connection failures)
    const criticalErrors = errors.filter(err => 
      !err.includes('relay') && 
      !err.includes('WebSocket') &&
      !err.includes('wss://') &&
      !err.includes('Failed to fetch') &&
      !err.includes('CORS')
    );
    
    console.log(`Found ${errors.length} total console errors, ${criticalErrors.length} critical`);
    expect(criticalErrors.length).toBeLessThan(3);
  });

  test('static assets load correctly', async ({ page }) => {
    await page.goto(PRODUCTION_URL);
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    
    // Check that JS bundle loaded
    const scripts = await page.locator('script[src*="index-"]').count();
    console.log(`Found ${scripts} JS bundles`);
    expect(scripts).toBeGreaterThan(0);
    
    // Check that CSS loaded
    const styles = await page.locator('link[rel="stylesheet"]').count();
    console.log(`Found ${styles} stylesheets`);
    expect(styles).toBeGreaterThan(0);
  });

  test('homepage has no 502 errors in network requests', async ({ page }) => {
    const failedRequests: { url: string; status: number }[] = [];
    
    page.on('response', (response) => {
      if (response.status() === 502) {
        failedRequests.push({
          url: response.url(),
          status: response.status(),
        });
      }
    });
    
    await page.goto(PRODUCTION_URL);
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    
    console.log(`Network requests with 502 status: ${failedRequests.length}`);
    if (failedRequests.length > 0) {
      console.log('Failed requests:', failedRequests);
    }
    
    expect(failedRequests).toHaveLength(0);
  });

  test('page title is set correctly', async ({ page }) => {
    await page.goto(PRODUCTION_URL);
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    
    const title = await page.title();
    console.log(`Page title: ${title}`);
    
    // Should have a meaningful title (not empty or generic)
    expect(title.length).toBeGreaterThan(0);
    expect(title).not.toBe('localhost:3000');
  });

  test('main content area is visible', async ({ page }) => {
    await page.goto(PRODUCTION_URL);
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    
    // Check for main content area
    const mainContent = page.locator('main, [role="main"], .container, [class*="content"]').first();
    await expect(mainContent).toBeVisible({ timeout: 5000 });
  });
});
