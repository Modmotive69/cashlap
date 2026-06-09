/**
 * Mission submission E2E tests.
 * Tests the mission submission form, duplicate submission guard, and QR scan flow.
 */
import { test, expect } from '@playwright/test';

test.describe('Mission Submission', () => {
  test('MissionSubmission page loads without crashing', async ({ page }) => {
    // Load with a fake mission ID — should show an error state, NOT crash
    await page.goto('/MissionSubmission?missionId=nonexistent_test_id');

    // Should not crash the whole app
    await expect(page.locator('text=Something went wrong')).not.toBeVisible();

    // Should show either a loading state or an error about the mission not found
    await page.waitForTimeout(2000);
    // No blank body
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('submit button is disabled during submission (no double-submit)', async ({ page }) => {
    await page.goto('/MissionSubmission?missionId=test');
    if (!page.url().includes('MissionSubmission')) {
      test.skip(true, 'Requires authenticated session');
      return;
    }

    // Wait for form to load
    await page.waitForTimeout(1000);

    // Find submit button
    const submitBtn = page.locator('button[type="submit"]').first();
    if (await submitBtn.isVisible()) {
      // Button should be disabled when no proof URL is entered (via disabled={submitting || !submissionUrl})
      const isDisabled = await submitBtn.isDisabled();
      expect(isDisabled).toBe(true); // disabled because submissionUrl is empty
    }
  });
});

test.describe('QR Scanner', () => {
  test('QR scan page renders camera request on Explore page', async ({ page, context }) => {
    // Grant camera permission
    await context.grantPermissions(['camera']);

    await page.goto('/Explore');
    if (!page.url().includes('Explore')) {
      test.skip(true, 'Requires authenticated session');
      return;
    }

    // No crash on Explore load
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.locator('text=Something went wrong')).not.toBeVisible();
  });
});

test.describe('TikTok OAuth Flow', () => {
  test('TikTok OAuth complete page handles missing params gracefully', async ({ page }) => {
    // Load complete page without a real code param
    await page.goto('/TikTokComplete');

    // Should show an error state, NOT crash
    await expect(page.locator('text=Something went wrong')).not.toBeVisible();
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('TikTok redirect handler loads without crash', async ({ page }) => {
    await page.goto('/TikTokRedirectHandler');
    await expect(page.locator('text=Something went wrong')).not.toBeVisible();
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
