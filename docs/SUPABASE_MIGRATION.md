# Base44 → Supabase Migration Plan

## Why Migrate?

CashLap's current architecture is 100% dependent on Base44's hosted BaaS:
- **No data ownership** — the database lives in Base44's infrastructure
- **No server logs** — errors are invisible without Sentry
- **No direct DB access** — can't run custom queries, migrations, or exports
- **Vendor lock-in** — pricing changes or outages take the app down
- **Scaling ceiling** — Base44's function limits can't be adjusted

Migration to Supabase + Vercel gives full ownership at comparable cost.

## Target Stack

| Layer | Current (Base44) | Target (Owned) |
|---|---|---|
| Auth | Base44 Auth | Supabase Auth (JWT, OAuth, magic link) |
| Database | Base44 entities | Supabase PostgreSQL |
| Serverless functions | Base44 functions | Vercel Edge Functions |
| File storage | Base44 storage | Supabase Storage |
| Realtime | N/A | Supabase Realtime (for notifications) |
| Hosting | Base44 sandbox | Vercel (React SPA) |

## Estimated Effort

| Phase | Work | Timeline |
|---|---|---|
| 1 — DB schema design | Model all Base44 entities as Postgres tables | 3 days |
| 2 — Auth migration | Swap Base44 auth for Supabase auth | 2 days |
| 3 — API layer | Rewrite 22 Base44 functions as Vercel edge functions | 2 weeks |
| 4 — Data migration | Export from Base44, import to Supabase | 2 days |
| 5 — Testing + cutover | E2E test, switch DNS, monitor | 1 week |
| **Total** | | **~3.5 weeks** |

---

## Phase 1 — Database Schema

### Entity Map (Base44 → Postgres)

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  display_name TEXT,
  account_type TEXT CHECK (account_type IN ('player', 'business')) DEFAULT 'player',
  business_id UUID REFERENCES businesses(id),
  business_name TEXT,
  business_balance NUMERIC(10,2) DEFAULT 0,
  total_earnings NUMERIC(10,2) DEFAULT 0,
  missions_completed INTEGER DEFAULT 0,
  influencer_rank TEXT DEFAULT 'rookie',
  total_followers INTEGER DEFAULT 0,
  tiktok_id TEXT,
  tiktok_username TEXT,
  tiktok_access_token TEXT, -- store encrypted
  tiktok_followers INTEGER DEFAULT 0,
  followers_last_updated TIMESTAMPTZ,
  stripe_account_id TEXT,
  stripe_customer_id TEXT,
  referral_code TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Businesses
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  address TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  logo_url TEXT,
  website TEXT,
  balance NUMERIC(10,2) DEFAULT 0,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Campaigns
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  reward_amount NUMERIC(10,2) NOT NULL,
  budget NUMERIC(10,2),
  max_participants INTEGER,
  participants_count INTEGER DEFAULT 0,
  status TEXT CHECK (status IN ('draft', 'active', 'paused', 'completed')) DEFAULT 'draft',
  start_date DATE,
  end_date DATE,
  requirements TEXT[],
  locations JSONB, -- [{address, latitude, longitude}]
  image_url TEXT,
  qr_codes JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Missions (player ↔ campaign instances)
CREATE TABLE missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) NOT NULL,
  user_id UUID REFERENCES users(id) NOT NULL,
  business_id UUID REFERENCES businesses(id) NOT NULL,
  title TEXT NOT NULL,
  reward_amount NUMERIC(10,2) NOT NULL,
  status TEXT CHECK (status IN ('active', 'submitted', 'approved', 'rejected')) DEFAULT 'active',
  proof_url TEXT,
  proof_type TEXT,
  submission_note TEXT,
  rejection_reason TEXT,
  check_in_location JSONB,
  check_in_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (campaign_id, user_id) -- prevents duplicate mission per user per campaign
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Row-Level Security (RLS)

```sql
-- Users can only see/edit their own record
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_self ON users USING (id = auth.uid());

-- Campaigns are public reads, business-owner writes
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY campaigns_read ON campaigns FOR SELECT USING (true);
CREATE POLICY campaigns_write ON campaigns FOR ALL USING (
  business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
);

-- Missions: players see their own, businesses see missions for their campaigns
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY missions_player ON missions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY missions_business ON missions FOR ALL USING (
  business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
);
```

---

## Phase 2 — Auth Migration

Base44 auth uses a token passed via URL param (`?access_token=...`) or localStorage. Supabase uses JWT with session cookies.

**Migration steps:**
1. Install `@supabase/supabase-js` → replace `@base44/sdk`
2. Swap `AuthContext.jsx`: `base44.auth.me()` → `supabase.auth.getUser()`
3. Swap `AuthGuard.jsx`: check `supabase.auth.getSession()`
4. Update `AuthCallback.jsx`: handle Supabase OAuth redirect
5. Replace `base44.auth.redirectToLogin()` with `supabase.auth.signInWithOAuth()` or `signInWithMagicLink()`

```js
// Before (Base44)
import { base44 } from '@/api/base44Client';
const user = await base44.auth.me();

// After (Supabase)
import { supabase } from '@/lib/supabase';
const { data: { user } } = await supabase.auth.getUser();
```

---

## Phase 3 — Serverless Functions

Each Base44 function in `base44/functions/` becomes a Vercel Edge Function in `api/`.

### Function Migration Map

| Base44 Function | Vercel Edge Function | Complexity |
|---|---|---|
| `createStripeCheckoutSession` | `api/stripe/checkout.js` | Medium |
| `processStripeWithdrawal` | `api/stripe/withdraw.js` | Medium |
| `stripeWebhook` | `api/stripe/webhook.js` | Medium |
| `createStripeConnectAccount` | `api/stripe/connect.js` | Medium |
| `initiateTikTokAuth` | `api/tiktok/auth.js` | Low |
| `completeTikTokOAuth` | `api/tiktok/callback.js` | Medium |
| `syncAndRankInfluencer` | `api/tiktok/sync.js` | Medium |
| `validateAndProcessCheckIn` | `api/missions/checkin.js` | Medium |
| `submitMissionProof` | `api/missions/submit.js` | Low |
| `processMissionApproval` | `api/missions/approve.js` | Low |
| `processMissionRejection` | `api/missions/reject.js` | Low |
| `geocodeAddress` | `api/maps/geocode.js` | Low |
| `getMapboxConfig` | `api/maps/config.js` | Low |
| `createNotification` | `api/notifications/create.js` | Low |
| `markNotificationsRead` | `api/notifications/read.js` | Low |
| `increaseCampaignBudget` | `api/campaigns/budget.js` | Low |

**Example Vercel Edge Function:**
```js
// api/stripe/checkout.js
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req) {
  const { user } = await supabase.auth.getUser(req.headers.get('Authorization'));
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { amount } = await req.json();

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{ price_data: { currency: 'usd', product_data: { name: 'CashLap Business Credit' }, unit_amount: Math.round(amount * 100) }, quantity: 1 }],
    mode: 'payment',
    success_url: `${process.env.APP_URL}/Dashboard?payment_success=true`,
    cancel_url: `${process.env.APP_URL}/BusinessFunding`,
    metadata: { user_id: user.id },
  });

  return Response.json({ url: session.url });
}
```

---

## Phase 4 — Data Migration

```bash
# 1. Export from Base44 (use their data export tool or API)
# 2. Transform to match Postgres schema
# 3. Import via Supabase dashboard or psql

psql $SUPABASE_DB_URL < transformed_data.sql

# 4. Verify record counts match
SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'campaigns', COUNT(*) FROM campaigns
UNION ALL SELECT 'missions', COUNT(*) FROM missions;
```

---

## Phase 5 — Cutover Checklist

- [ ] All E2E tests passing against new stack
- [ ] Stripe webhook URL updated to new Vercel endpoint
- [ ] TikTok OAuth redirect URI updated in TikTok developer console
- [ ] Mapbox API key moved to Vercel env vars
- [ ] DNS cutover (CNAME cashlap.app → Vercel)
- [ ] Sentry release tag updated
- [ ] Monitor error rate for 48h post-cutover
- [ ] Base44 account kept active for 30 days as fallback

---

## Cost Comparison

| Service | Base44 | Supabase + Vercel |
|---|---|---|
| Database | Included | Supabase Free tier (500MB) → Pro $25/mo |
| Functions | Included | Vercel Free (100GB-hrs) → Pro $20/mo |
| Auth | Included | Supabase Free (50K MAU) |
| Storage | Included | Supabase Free (1GB) |
| **Total** | Base44 pricing | **~$45/mo at scale** |

---

## Decision Framework

**Stay on Base44 if:**
- You're still validating the business model
- You need to ship features fast (next 3 months)
- You want to minimize DevOps complexity

**Migrate to Supabase if:**
- You have paying users and need SLA/reliability guarantees
- You need direct DB access for analytics or custom queries
- You're pitching to investors (owning your stack matters)
- Base44 pricing becomes a concern at scale

---

*Document prepared by PenPen 🐧 — June 9, 2026*
