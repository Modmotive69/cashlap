# CashLap

A two-sided influencer marketing platform. **Businesses** create location-based campaigns and fund missions. **Players** (TikTok influencers) complete missions at physical locations and earn cash rewards. Influencer tier (Rookie → Legend) is determined by TikTok follower count and applies a reward multiplier.

## Tech Stack

- **Frontend:** Vite + React 18 + Tailwind CSS + shadcn/ui
- **Backend:** [Base44](https://base44.com) (hosted BaaS — auth, DB, serverless functions)
- **Payments:** Stripe (checkout, webhooks, payouts)
- **Social:** TikTok OAuth + follower sync
- **Maps:** Mapbox + Leaflet/react-leaflet

## Prerequisites

- Node.js 18+
- A [Base44](https://base44.com) account with an app created
- Stripe account (for payments)
- TikTok Developer app (for OAuth)
- Mapbox API key (for geocoding/maps)

## Quick Start

```bash
# Clone
git clone https://github.com/Modmotive69/cashlap.git
cd cashlap

# Install dependencies
npm install

# Create env file (see Environment Variables below)
cp .env.example .env
# Edit .env with your values

# Start dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Environment Variables

Create a `.env` file in the project root:

```env
# Required — your Base44 app ID (from base44.com dashboard)
VITE_BASE44_APP_ID=your_base44_app_id

# Optional — Base44 backend URL (for local proxy / self-hosted)
# VITE_BASE44_BACKEND_URL=https://api.base44.com

# Required for legacy SDK imports during build
BASE44_LEGACY_SDK_IMPORTS=true
```

**Note:** Stripe keys, TikTok OAuth credentials, and Mapbox tokens are configured inside Base44 as server-side environment variables (not in this repo).

## Building for Production

```bash
npm run build
# Output: dist/
```

The build uses Terser with `drop_console: true` — all `console.*` calls are stripped in production.

## Deployment

### Vercel (recommended)
1. Connect `Modmotive69/cashlap` repo in Vercel dashboard
2. Set `VITE_BASE44_APP_ID` in Environment Variables
3. Set `BASE44_LEGACY_SDK_IMPORTS=true` in Environment Variables
4. Deploy

### Manual
```bash
npm run build
# Serve the dist/ folder with any static host (Netlify, Cloudflare Pages, S3+CloudFront, etc.)
```

## Project Structure

```
src/
├── pages/              # Route-level pages (lazy-loaded)
├── components/
│   ├── ui/             # shadcn/ui component library
│   ├── dashboard/      # BusinessDashboardContent, PlayerDashboardContent
│   ├── auth/           # AuthGuard, useInactivityLogout
│   ├── qr/             # QRCodeGenerator, QRScanner
│   └── utils/          # sanitizer.jsx, rateLimiter.jsx
├── hooks/
│   └── useDashboard.js # Dashboard data-loading hook
├── lib/
│   ├── AuthContext.jsx  # Auth provider + useAuth hook
│   └── app-params.js   # Base44 app params from URL/localStorage
├── api/
│   └── base44Client.js # Base44 SDK client
└── pages.config.js     # Route definitions (lazy-loaded)
```

## Architecture Notes

- **Dual-role UX:** `account_type: 'business' | 'player'` — Layout + Dashboard branch on this
- **Auth:** Base44 handles all auth. `AuthGuard` wraps protected routes. `useInactivityLogout` auto-logs out after idle
- **Code splitting:** All pages are `React.lazy()` wrapped, loaded on demand
- **Sanitization:** All user input runs through `sanitizeObject()` before Base44 writes (XSS prevention)
- **Rate limiting:** Custom `RateLimiter` + `CircuitBreaker` in `src/components/utils/rateLimiter.jsx`

## Influencer Tier System

| Tier | Followers | Multiplier |
|---|---|---|
| 🐣 Rookie (Nano) | 0–9,999 | 1.0× |
| 🔥 Trendsetter (Micro) | 10K–99K | 1.25× |
| 🎶 Vibe Curator (Mid-Tier) | 100K–999K | 1.5× |
| 🌟 Icon (Macro) | 1M–9.9M | 2.0× |
| 👑 Legend (Mega) | 10M+ | 3.0× |

## Base44 Backend

All backend logic lives in `base44/functions/` — these are serverless functions deployed to Base44:

- `createStripeCheckoutSession` / `processStripeWithdrawal` — payments
- `initiateTikTokAuth` / `completeTikTokOAuth` / `syncAndRankInfluencer` — TikTok OAuth
- `validateAndProcessCheckIn` — QR scan → mission check-in
- `submitMissionProof` / `processMissionApproval` / `processMissionRejection` — mission lifecycle
- `geocodeAddress` / `getMapboxConfig` — map support

## Security Notes

- **XSS:** Input sanitized via `sanitizer.jsx` before all DB writes
- **Auth:** Base44 JWT, inactivity logout, per-route AuthGuard
- **Rate limiting:** Client-side sliding window + circuit breaker
- **Dependencies:** Run `npm audit fix` after install; 4 remaining vulns require upstream fixes (quill/dompurify)

## Known Limitations

- Backend is fully dependent on Base44 BaaS — no self-hosted option without significant migration
- `quill` (via jspdf) has a known XSS moderate severity; fix requires `npm audit fix --force` which is a breaking jspdf change
- No server-side rendering (pure SPA)

## License

Private — all rights reserved.
