/**
 * Sentry error monitoring initialization.
 *
 * Setup:
 * 1. Create a free project at https://sentry.io
 * 2. Set VITE_SENTRY_DSN in your .env file
 * 3. That's it — Sentry auto-captures unhandled errors, promise rejections,
 *    and performance traces.
 *
 * To test: throw new Error('Sentry test') anywhere in the app.
 */
import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

export function initSentry() {
  if (!SENTRY_DSN) {
    // No DSN set — Sentry is disabled (safe for local dev)
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE, // 'production' | 'development'
    release: import.meta.env.VITE_APP_VERSION || '1.0.0',

    // Performance monitoring — capture 10% of transactions in prod
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,

    // Session replay — capture 10% of sessions, 100% on errors
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Mask all user input by default (PII protection)
        maskAllInputs: true,
        blockAllMedia: false,
      }),
    ],

    // Don't send errors from localhost
    beforeSend(event) {
      if (window.location.hostname === 'localhost') return null;
      return event;
    },
  });
}

/**
 * Capture a caught error with context.
 * Use instead of console.error for errors you want tracked.
 *
 * @example
 * captureError(err, { context: 'stripe_checkout', userId: user.id })
 */
export function captureError(error, context = {}) {
  if (!SENTRY_DSN) {
    console.error('[Error]', error, context);
    return;
  }
  Sentry.withScope((scope) => {
    scope.setExtras(context);
    Sentry.captureException(error);
  });
}

/**
 * Identify the current user in Sentry for better error context.
 * Call after successful auth.
 */
export function identifyUser(user) {
  if (!SENTRY_DSN) return;
  Sentry.setUser({
    id: user.id,
    email: user.email,
    account_type: user.account_type,
  });
}

/**
 * Clear user identity on logout.
 */
export function clearSentryUser() {
  if (!SENTRY_DSN) return;
  Sentry.setUser(null);
}

export { Sentry };
