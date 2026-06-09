import { useState, useEffect, useCallback } from "react";
import { User, Mission, Business, Campaign } from "@/entities/all";

export function useDashboard() {
  const [user, setUser] = useState(null);
  const [missions, setMissions] = useState([]);
  const [missionBusinesses, setMissionBusinesses] = useState({});
  const [business, setBusiness] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);

  const loadData = useCallback(async (manualRefresh = false) => {
    if (manualRefresh) setIsRefreshing(true);
    if (!manualRefresh) setLoading(true);
    setError(null);

    try {
      const currentUser = await User.me();
      if (currentUser.account_type === 'player' && !currentUser.total_followers) {
        currentUser.total_followers = 0;
      }
      setUser(currentUser);

      if (currentUser.account_type === 'business') {
        if (currentUser.business_id) {
          try {
            const businesses = await Business.filter({ id: currentUser.business_id });
            if (businesses?.length > 0) setBusiness(businesses[0]);
          } catch {}
          try {
            const campaignList = await Campaign.filter({ business_id: currentUser.business_id }, '-created_date', 5);
            setCampaigns(campaignList);
          } catch { setCampaigns([]); }
        }
      } else {
        try {
          const userMissions = await Mission.filter({ user_id: currentUser.id }, '-created_date', 10);
          setMissions(userMissions);
          const bizIds = [...new Set(userMissions.map(m => m.business_id).filter(Boolean))];
          if (bizIds.length > 0) {
            const bizList = await Business.filter({ id: { $in: bizIds } });
            const bizMap = {};
            bizList.forEach(b => { bizMap[b.id] = b.name; });
            setMissionBusinesses(bizMap);
          }
        } catch { setMissions([]); }
      }
    } catch (err) {
      console.error("Error loading dashboard data:", err);
      setError("Unable to load dashboard data. Please try refreshing.");
    } finally {
      setLoading(false);
      if (manualRefresh) setIsRefreshing(false);
    }
  }, []);

  // Payment success polling
  useEffect(() => {
    loadData();
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment_success') || urlParams.get('session_id')) {
      setIsVerifyingPayment(true);
      window.history.replaceState({}, document.title, window.location.pathname);
      let attempts = 0;
      const pollForBalanceUpdate = async (prevBalance) => {
        attempts++;
        try {
          await loadData(true);
          const freshUser = await User.me();
          const newBalance = freshUser?.business_balance ?? freshUser?.total_earnings ?? null;
          if (newBalance !== null && newBalance !== prevBalance) {
            setIsVerifyingPayment(false);
            return;
          }
        } catch {}
        if (attempts < 5) setTimeout(() => pollForBalanceUpdate(prevBalance), 2000);
        else setIsVerifyingPayment(false);
      };
      setTimeout(() => pollForBalanceUpdate(null), 1000);
    }
  }, [loadData]);

  // Focus refresh (debounced — 60s min interval)
  useEffect(() => {
    let lastFocusRefresh = 0;
    const handleFocus = () => {
      if (user?.account_type === 'business' && Date.now() - lastFocusRefresh > 60000) {
        lastFocusRefresh = Date.now();
        loadData(true);
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user, loadData]);

  return { user, setUser, missions, missionBusinesses, business, campaigns, loading, error, setError, isRefreshing, isVerifyingPayment, loadData };
}
