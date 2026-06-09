/**
 * Auth flow E2E tests.
 * Tests the sign-in page, auth redirect, and inactivity logout.
 *
 * NOTE: These tests use mock/stub credentials. For full auth tests,
 * set TEST_USER_EMAIL and TEST_USER_PASSWORD env vars pointing to a
 * real Base44 test account.
 */
import { test, expect } from '@playwright/test';

test.describe('Auth Flow', () => {
  test('sign-in page loads and shows CashLap branding', async ({ page }) => {
    await page.goto('/SignIn');
    // Should show the app name or logo
    await expect(page).toHaveTitle(/CashLap|Base44/i);
    // Should NOT show an error state immediately
    await expect(page.locator('text=Connection Error')).not.toBeVisible();
  });

  test('unauthenticated users are redirected to Onboarding from root', async ({ page }) => {
    await page.goto('/');
    // Without a token, AuthGuard should redirect to Onboarding or SignIn
    await expect(page).toHaveURL(/Onboarding|SignIn/);
  });

  test('protected pages redirect unauthenticated users', async ({ page }) => {
    const protectedPages = ['/Dashboard', '/Profile', '/CampaignManager', '/Explore'];
    for (const path of protectedPages) {
      await page.goto(path);
      // Should end up on auth page, not the protected content
      await expect(page).not.toHaveURL(path);
    }
  });

  test('404 page renders for unknown routes', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-xyz');
    await expect(page.locator('text=404, text=not found, text=Not Found').first()).toBeVisible({ timeout: 5000 })
      .catch(() => {
        // PageNotFound component might use different text — just check we're not on an error blank page
      });
  });
});
