/**
 * useCampaigns — shared data hook for Campaigns.jsx and CampaignManager.jsx.
 *
 * Previously both pages duplicated campaign + submission count fetching.
 * This hook is the single source of truth. It handles:
 * - Fetching campaigns for the authenticated business user
 * - Submission count per campaign (pending missions)
 * - Rate-limit awareness via rateLimiter singleton
 * - Retry on 429 with exponential backoff (no artificial delays)
 * - Cache via rateLimiter.getCachedData / setCachedData
 */
import { useState, useEffect, useCallback } from 'react';
import { User, Campaign, Mission, Business } from '@/entities/all';
import { rateLimiter } from '@/components/utils/rateLimiter';
import { captureError } from '@/lib/sentry';

const withRetry = async (fn, maxAttempts = 3) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is429 = err?.status === 429 || err?.message?.includes('Rate limit');
      if (is429 && attempt < maxAttempts) {
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
};

export function useCampaigns() {
  const [user, setUser] = useState(null);
  const [business, setBusiness] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [missions, setMissions] = useState([]);
  const [submissionCounts, setSubmissionCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async (forceRefresh = false) => {
    // Bail early if rate-limited (unless forcing)
    if (!forceRefresh && rateLimiter.isRateLimited()) {
      const lastLimit = localStorage.getItem('last_rate_limit_time');
      const remaining = Math.ceil((rateLimiter.RATE_LIMIT_COOLDOWN - (Date.now() - parseInt(lastLimit || '0'))) / 1000);
      setError(`Rate limited. Please wait ${remaining}s before refreshing.`);
      setLoading(false);
      return;
    }

    // Use cache on first load
    if (!forceRefresh) {
      const cached = rateLimiter.getCachedData();
      if (cached) {
        setUser(cached.user);
        setCampaigns(cached.campaigns);
        setSubmissionCounts(cached.submissionCounts);
        setMissions(cached.missions || []);
        setLoading(false);
        return;
      }
    }

    forceRefresh ? setIsRefreshing(true) : setLoading(true);
    setError('');

    try {
      const currentUser = await withRetry(() => User.me());
      setUser(currentUser);

      // Load business profile
      if (currentUser.business_id) {
        const bizList = await withRetry(() => Business.filter({ id: currentUser.business_id }));
        if (bizList?.length > 0) setBusiness(bizList[0]);
      }

      // Fetch campaigns — primary: by business_id
      let fetchedCampaigns = [];

      if (currentUser.business_id) {
        try {
          const byBiz = await withRetry(() =>
            Campaign.filter({ business_id: currentUser.business_id }, '-created_date')
          );
          fetchedCampaigns = byBiz;
        } catch (e) {
          captureError(e, { context: 'useCampaigns.fetchByBusinessId' });
        }
      }

      // Fallback: list + filter by email if primary returned nothing
      if (fetchedCampaigns.length === 0) {
        try {
          const all = await withRetry(() => Campaign.list('-created_date', 100));
          fetchedCampaigns = all.filter(c =>
            (currentUser.business_id && c.business_id === currentUser.business_id) ||
            c.created_by === currentUser.email
          );
        } catch (e) {
          captureError(e, { context: 'useCampaigns.fetchFallback' });
        }
      }

      // Deduplicate
      const unique = Array.from(new Map(fetchedCampaigns.map(c => [c.id, c])).values());

      // Validate ownership
      const validated = unique.filter(c =>
        (currentUser.business_id && c.business_id === currentUser.business_id) ||
        c.created_by === currentUser.email
      );
      setCampaigns(validated);

      // Submission counts
      let counts = {};
      let allMissions = [];
      if (validated.length > 0) {
        try {
          const campaignIds = validated.map(c => c.id);
          allMissions = await withRetry(() => Mission.filter({ campaign_id: { $in: campaignIds } }));
          counts = allMissions
            .filter(m => m.status === 'submitted')
            .reduce((acc, m) => {
              acc[m.campaign_id] = (acc[m.campaign_id] || 0) + 1;
              return acc;
            }, {});
        } catch (e) {
          captureError(e, { context: 'useCampaigns.fetchMissions' });
        }
      }
      setMissions(allMissions);
      setSubmissionCounts(counts);

      // Update cache
      rateLimiter.setCachedData({
        user: currentUser,
        campaigns: validated,
        submissionCounts: counts,
        missions: allMissions,
      });

    } catch (err) {
      captureError(err, { context: 'useCampaigns.refresh' });
      if (err?.status === 429 || err?.message?.includes('Rate limit')) {
        rateLimiter.markRateLimited();
        setError('Rate limit exceeded. Please wait a moment and try again.');
      } else {
        setError('Failed to load campaigns. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { user, business, campaigns, missions, submissionCounts, loading, isRefreshing, error, refresh };
}
