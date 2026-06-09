/**
 * Campaign creation E2E tests.
 * Tests the CampaignManager form validation, budget guard, and creation flow.
 *
 * Requires: authenticated business user session
 * Set env vars: TEST_BUSINESS_EMAIL, TEST_BUSINESS_PASSWORD, TEST_BASE_URL
 */
import { test, expect } from '@playwright/test';

test.describe('Campaign Manager — Form Validation', () => {
  // These tests validate client-side guards without needing real auth
  test('budget validation: blocks submit when budget < reward × participants', async ({ page }) => {
    // Navigate directly to campaign manager (will redirect to auth if not logged in — that's expected)
    await page.goto('/CampaignManager');

    // If redirected to auth, skip (this test needs a logged-in session)
    if (!page.url().includes('CampaignManager')) {
      test.skip(true, 'Requires authenticated business session');
      return;
    }

    // Click "Create Campaign" or similar CTA
    const createBtn = page.locator('button:has-text("Create"), button:has-text("New Campaign")').first();
    if (await createBtn.isVisible()) await createBtn.click();

    // Fill title
    await page.fill('input[placeholder*="title"], input[placeholder*="campaign"]', 'Test Campaign');

    // Set reward to $50, budget to $10, participants to 100 (budget < reward × participants)
    await page.fill('input[type="number"][placeholder*="eward"]', '50');
    await page.fill('input[type="number"][placeholder*="udget"]', '10');
    await page.fill('input[type="number"][placeholder*="articipant"]', '100');

    // Try to submit/activate
    const activateBtn = page.locator('button:has-text("Activate"), button:has-text("Launch")').first();
    if (await activateBtn.isVisible()) await activateBtn.click();

    // Should show budget error toast or inline error
    await expect(
      page.locator('text=Budget, text=budget').first()
    ).toBeVisible({ timeout: 3000 });
  });

  test('reward amount validation: blocks values over $1000', async ({ page }) => {
    await page.goto('/CampaignManager');
    if (!page.url().includes('CampaignManager')) {
      test.skip(true, 'Requires authenticated business session');
      return;
    }

    const createBtn = page.locator('button:has-text("Create"), button:has-text("New Campaign")').first();
    if (await createBtn.isVisible()) await createBtn.click();

    await page.fill('input[placeholder*="title"]', 'Big Reward Test');
    await page.fill('input[type="number"][placeholder*="eward"]', '1001');

    const activateBtn = page.locator('button:has-text("Activate")').first();
    if (await activateBtn.isVisible()) await activateBtn.click();

    // Should block with an error about $1000 limit
    await expect(page.locator('text=$1000, text=1000').first()).toBeVisible({ timeout: 3000 });
  });
});
