/**
 * PostHog analytics initialization.
 *
 * PostHog is open-source, GDPR-friendly, and has a generous free tier (1M events/mo).
 * It provides: funnels, session recordings, feature flags, A/B testing.
 *
 * Setup:
 * 1. Create a free project at https://posthog.com (or self-host)
 * 2. Set VITE_POSTHOG_KEY in your .env file
 * 3. Optionally set VITE_POSTHOG_HOST (default: https://app.posthog.com)
 *
 * Key events tracked:
 * - user_signed_in / user_signed_out
 * - mission_viewed / mission_submitted / mission_approved / mission_rejected
 * - campaign_created / campaign_activated / campaign_paused
 * - qr_scan_started / qr_scan_success / qr_scan_failed
 * - withdraw_initiated / withdraw_success
 * - tiktok_link_started / tiktok_link_success / tiktok_link_failed
 * - payment_initiated / payment_success / payment_failed
 * - page_viewed (auto via autocapture)
 */
import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com';

let initialized = false;

export function initAnalytics() {
  if (!POSTHOG_KEY || initialized) return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    // Autocapture clicks, inputs, page views
    autocapture: true,
    // Don't capture localhost traffic
    loaded: (ph) => {
      if (window.location.hostname === 'localhost') {
        ph.opt_out_capturing();
      }
    },
    // Session recording — capture 20% of sessions
    session_recording: {
      recordCrossOriginIframes: false,
    },
    // Persistence
    persistence: 'localStorage',
  });

  initialized = true;
}

/**
 * Identify a user after sign-in.
 * @param {object} user — Base44 user object
 */
export function identifyAnalyticsUser(user) {
  if (!initialized) return;
  posthog.identify(user.id, {
    email: user.email,
    name: user.display_name || user.full_name,
    account_type: user.account_type,
    influencer_rank: user.influencer_rank,
    tiktok_linked: Boolean(user.tiktok_access_token),
  });
}

/**
 * Reset analytics identity on logout.
 */
export function resetAnalyticsUser() {
  if (!initialized) return;
  posthog.reset();
}

/**
 * Track a named event with optional properties.
 *
 * @example
 * track('mission_submitted', { mission_id: 'abc', reward: 10 })
 */
export function track(event, properties = {}) {
  if (!initialized) return;
  posthog.capture(event, properties);
}

/**
 * Pre-built event helpers for the most important funnel steps.
 */
export const analytics = {
  // Auth
  signIn: (user) => track('user_signed_in', { account_type: user.account_type }),
  signOut: () => track('user_signed_out'),

  // Mission funnel (player)
  missionViewed: (missionId, reward) => track('mission_viewed', { mission_id: missionId, reward }),
  missionSubmitted: (missionId, reward) => track('mission_submitted', { mission_id: missionId, reward }),
  missionApproved: (missionId, reward) => track('mission_approved', { mission_id: missionId, reward }),
  missionRejected: (missionId, reason) => track('mission_rejected', { mission_id: missionId, reason }),

  // Campaign funnel (business)
  campaignCreated: (campaignId, budget) => track('campaign_created', { campaign_id: campaignId, budget }),
  campaignActivated: (campaignId) => track('campaign_activated', { campaign_id: campaignId }),
  campaignPaused: (campaignId) => track('campaign_paused', { campaign_id: campaignId }),

  // QR check-in
  qrScanStarted: (campaignId) => track('qr_scan_started', { campaign_id: campaignId }),
  qrScanSuccess: (campaignId, missionId) => track('qr_scan_success', { campaign_id: campaignId, mission_id: missionId }),
  qrScanFailed: (campaignId, reason) => track('qr_scan_failed', { campaign_id: campaignId, reason }),

  // Payments (business)
  paymentInitiated: (amount) => track('payment_initiated', { amount }),
  paymentSuccess: (amount) => track('payment_success', { amount }),
  paymentFailed: (reason) => track('payment_failed', { reason }),

  // Withdraw (player)
  withdrawInitiated: (amount) => track('withdraw_initiated', { amount }),
  withdrawSuccess: (amount) => track('withdraw_success', { amount }),

  // TikTok
  tiktokLinkStarted: () => track('tiktok_link_started'),
  tiktokLinkSuccess: (followers, rank) => track('tiktok_link_success', { followers, rank }),
  tiktokLinkFailed: (reason) => track('tiktok_link_failed', { reason }),
};

export default posthog;
