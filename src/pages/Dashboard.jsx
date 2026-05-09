import { useState, useEffect, useCallback } from "react";
import { User, Mission, Business, Campaign } from "@/entities/all";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Coins,
  Star,
  MapPin,
  TrendingUp,
  Camera,
  ChevronRight,
  Target,
  Gift,
  LogOut,
  BarChart2,
  Plus,
  Users,
  DollarSign,
  Briefcase,
  User as UserIcon,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import WithdrawModal from "@/components/dashboard/WithdrawModal";
import AuthGuard from "@/components/auth/AuthGuard";

const INFLUENCER_TIERS = {
  rookie: { name: 'Rookie', subtitle: 'Nano', emoji: '🐣', description: 'Just starting their rise to fame.', minFollowers: 0, maxFollowers: 9999, multiplier: 1.0, color: '#94A3B8' },
  trendsetter: { name: 'Trendsetter', subtitle: 'Micro', emoji: '🔥', description: 'Sparking buzz and gaining attention.', minFollowers: 10000, maxFollowers: 99999, multiplier: 1.25, color: '#F97316' },
  vibe_curator: { name: 'Vibe Curator', subtitle: 'Mid-Tier', emoji: '🎶', description: 'Setting trends and building a loyal following.', minFollowers: 100000, maxFollowers: 999999, multiplier: 1.5, color: '#8B5CF6' },
  icon: { name: 'Icon', subtitle: 'Macro', emoji: '🌟', description: 'Recognized everywhere, leading the scene.', minFollowers: 1000000, maxFollowers: 9999999, multiplier: 2.0, color: '#EAB308' },
  legend: { name: 'Legend', subtitle: 'Mega', emoji: '👑', description: 'Elite status, cultural influencer, unstoppable.', minFollowers: 10000000, maxFollowers: Infinity, multiplier: 3.0, color: '#DC2626' }
};

// Ordered list of ranks for easy progression lookup
const RANK_ORDER = ['rookie', 'trendsetter', 'vibe_curator', 'icon', 'legend'];

function DashboardContent() {
  const [user, setUser] = useState(null);
  const [missions, setMissions] = useState([]);
  const [missionBusinesses, setMissionBusinesses] = useState({});
  const [business, setBusiness] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);

  // Simplified load data function - no complex caching or rate limiting
  const loadData = useCallback(async (manualRefresh = false) => {
    if (manualRefresh) setIsRefreshing(true);
    if (!manualRefresh) setLoading(true);
    setError(null);

    try {
      const currentUser = await User.me();
      // Ensure total_followers is set for players, default to 0 if not present for UI display
      if (currentUser.account_type === 'player' && !currentUser.total_followers) {
        currentUser.total_followers = 0; 
      }
      setUser(currentUser);

      if (currentUser.account_type === 'business') {
        // Load business data
        if (currentUser.business_id) {
          try {
            const businesses = await Business.filter({ id: currentUser.business_id });
            if (businesses && businesses.length > 0) {
              setBusiness(businesses[0]);
            }
          } catch (err) {
            console.warn('Failed to load business data:', err);
          }
          
          try {
            const campaignList = await Campaign.filter({ business_id: currentUser.business_id }, '-created_date', 5);
            setCampaigns(campaignList);
          } catch (err) {
            console.warn('Failed to load campaigns:', err);
            setCampaigns([]);
          }
        }
      } else {
        // Load player data
        try {
          const userMissions = await Mission.filter({ user_id: currentUser.id }, '-created_date', 10);
          setMissions(userMissions);

          // Load business names for missions
          const bizIds = [...new Set(userMissions.map(m => m.business_id).filter(Boolean))];
          if (bizIds.length > 0) {
            const bizList = await Business.filter({ id: { $in: bizIds } });
            const bizMap = {};
            bizList.forEach(b => { bizMap[b.id] = b.name; });
            setMissionBusinesses(bizMap);
          }
        } catch (err) {
          console.warn('Failed to load missions:', err);
          setMissions([]);
        }
      }
      
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      setError("Unable to load dashboard data. Please try refreshing.");
    } finally {
      setLoading(false);
      if (manualRefresh) setIsRefreshing(false);
    }
  }, []); // Empty dependency array is safe now

  // Single useEffect for initial data load and payment success handling
  useEffect(() => {
    loadData();

    // Check for payment success on initial load
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment_success') || urlParams.get('session_id')) {
      setIsVerifyingPayment(true);
      console.log('Payment success detected - will verify and refresh balance.');
      
      // Clear the URL parameters to prevent re-triggering
      window.history.replaceState({}, document.title, window.location.pathname);

      // Give webhook time to process, then refresh data
      setTimeout(() => {
        loadData(true).finally(() => {
          setIsVerifyingPayment(false);
          console.log('Balance refresh complete.');
        });
      }, 3000); // Increased to 3 seconds for better reliability
    }
  }, [loadData]);
  
  // Keep separate effect for focus handling
  useEffect(() => {
    const handleFocus = () => {
      // Refresh data when window regains focus (user returns from Stripe)
      if (user && user.account_type === 'business') {
        console.log('Window focused - refreshing business data');
        loadData(true);
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user, loadData]);

  const handleWithdrawSuccess = (newBalance) => {
    setShowWithdrawModal(false);
    if (user) {
      setUser({ ...user, total_earnings: newBalance });
    }
  };

  const handleLogout = async () => {
    try {
      await User.logout();
      window.location.reload();
    } catch (error) {
      console.error("Error logging out:", error);
      window.location.reload();
    }
  };

  const handleMissionClick = (mission) => {
    if (!mission || !mission.id) {
      alert("This mission's details are incomplete.");
      return;
    }
    window.location.href = `/MissionSubmission?missionId=${mission.id}`;
  };

  const getRankProgress = () => {
    if (!user || user.account_type !== 'player') {
      return { percentage: 0, current: 0, target: 0, nextRankName: 'Trendsetter', isMaxRank: false };
    }

    const currentRankKey = user.influencer_rank || 'rookie';
    const currentFollowers = user.total_followers || 0;

    const currentRankIndex = RANK_ORDER.indexOf(currentRankKey);
    const currentRankData = INFLUENCER_TIERS[currentRankKey];

    // Handle the highest rank
    if (currentRankIndex === RANK_ORDER.length - 1) {
      return {
        percentage: 100,
        current: currentFollowers,
        target: currentFollowers,
        nextRankName: 'Legend',
        isMaxRank: true,
      };
    }

    const nextRankKey = RANK_ORDER[currentRankIndex + 1];
    const nextRankData = INFLUENCER_TIERS[nextRankKey];

    const progressStart = currentRankData.minFollowers;
    const progressEnd = nextRankData.minFollowers;

    const followersInCurrentTier = Math.max(0, currentFollowers - progressStart);
    const followersNeededForNextTier = progressEnd - progressStart;

    let percentage = 0;
    if (followersNeededForNextTier > 0) {
        percentage = (followersInCurrentTier / followersNeededForNextTier) * 100;
    } else if (currentFollowers >= progressEnd) { // If target is 0 or passed
        percentage = 100;
    }

    percentage = Math.min(percentage, 100); // Cap at 100%

    return {
      percentage,
      current: currentFollowers,
      target: progressEnd,
      nextRankName: nextRankData.name,
      isMaxRank: false,
    };
  };

  // Simplified loading state
  if (loading && !isVerifyingPayment) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-[var(--cashlap-green)]" />
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="p-4">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <h3 className="text-lg font-semibold mb-2">Connection Error</h3>
            <p className="text-sm mb-4">{error}</p>
            <Button onClick={() => loadData(true)} className="bg-[var(--cashlap-green)] hover:opacity-90">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Could Not Load Dashboard</h3>
            <p className="text-sm text-gray-600 mb-4">
              Please check your connection and try again.
            </p>
            <Button onClick={() => loadData(true)} disabled={isRefreshing}>
              {isRefreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeMissions = missions.filter(m => m.status === 'active');
  const recentMissions = missions.filter(m => ['approved', 'rejected'].includes(m.status)).slice(0, 3);
  
  // Get influencer rank data for the player — recalculate dynamically from total_followers as source of truth
  const getDynamicRank = (totalFollowers) => {
    for (const [key, tier] of Object.entries(INFLUENCER_TIERS)) {
      if (totalFollowers >= tier.minFollowers && totalFollowers <= tier.maxFollowers) return { key, ...tier };
    }
    return { key: 'rookie', ...INFLUENCER_TIERS.rookie };
  };
  const dynamicRank = user.account_type === 'player' ? getDynamicRank(user.total_followers || 0) : null;
  const rankData = user.account_type === 'player' ? (dynamicRank || INFLUENCER_TIERS[user.influencer_rank || 'rookie']) : null;
  const rankProgress = user.account_type === 'player' ? getRankProgress() : null;

  return (
    <div className="p-4 space-y-4 pb-24 max-w-lg mx-auto">
      {isVerifyingPayment && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="bg-blue-50 border border-blue-200 p-3 rounded-xl mb-4 text-center"
        >
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
            <p className="text-sm font-medium text-blue-800">Verifying payment and updating your balance...</p>
          </div>
        </motion.div>
      )}

      <div className="flex justify-between items-center">
        <Badge variant="outline" className={`${user.account_type === 'business' ? 'bg-blue-100 text-[var(--cashlap-blue)] border-blue-200' : 'bg-green-100 text-[var(--cashlap-green)] border-green-200'}`}>
          {user.account_type === 'business' ? (
            <>
              <Briefcase className="w-3 h-3 mr-1" />
              Business
            </>
          ) : (
            <>
              <UserIcon className="w-3 h-3 mr-1" />
              Player
            </>
          )}
        </Badge>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="text-gray-600 hover:text-gray-800"
          >
            {isRefreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Refresh
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-gray-600 hover:text-gray-800"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Log Out
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <div>
                <p className="text-amber-800 text-sm">{error}</p>
                <Button variant="outline" size="sm" onClick={() => setError(null)} className="mt-2">
                  Dismiss
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Welcome Card - Redesigned */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl p-6 text-white`}
        style={{
          background: user.account_type === 'business'
            ? 'var(--cashlap-blue)'
            : `linear-gradient(135deg, ${rankData.color} 0%, #4a5568 100%)`
        }}
      >
        {user.account_type === 'business' ? (
          // Business Card - Unchanged
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">
                {user.business_name || business?.name || "Business Dashboard"}
              </h2>
              <p className="text-blue-100 mt-1">
                Manage your campaigns and track performance
              </p>
            </div>
            <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/8a050254a_20250612_0908_TranslucentGreenCube_remix_01jxj7f9waej1th5v95nhpaa9t.png" alt="CASH Mascot" className="w-20 h-20 object-contain" />
          </div>
        ) : (
          // Player Card - Redesigned for Influencer Rank
          <div>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white leading-tight">{user.display_name || user.full_name}</h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-3xl">{rankData.emoji}</span>
                  <div>
                    <h3 className="text-xl font-bold text-white leading-tight">{rankData.name}</h3>
                    <p className="text-sm text-white/80 leading-tight">{rankData.subtitle} Influencer</p>
                  </div>
                </div>
                <p className="text-xs text-white/70 mt-2 max-w-[280px]">{rankData.description}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="bg-white/10 p-2 rounded-lg">
                <Coins className="w-4 h-4 mx-auto text-yellow-300 mb-1" />
                <p className="text-lg font-bold">${(user?.total_earnings || 0).toFixed(2)}</p>
                <p className="text-[10px] uppercase tracking-wider text-white/70">Earned</p>
              </div>
              <div className="bg-white/10 p-2 rounded-lg">
                <Zap className="w-4 h-4 mx-auto text-pink-300 mb-1" />
                <p className="text-lg font-bold">{rankData.multiplier}x</p>
                <p className="text-[10px] uppercase tracking-wider text-white/70">Multiplier</p>
              </div>
              <div className="bg-white/10 p-2 rounded-lg">
                <Users className="w-4 h-4 mx-auto text-blue-300 mb-1" />
                <p className="text-lg font-bold">{(user.total_followers || 0).toLocaleString()}</p>
                <p className="text-[10px] uppercase tracking-wider text-white/70">Followers</p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-white text-xs">
                <span>{rankProgress.isMaxRank ? 'Legend Status Achieved!' : `Road to ${rankProgress.nextRankName}`}</span>
                {!rankProgress.isMaxRank && (
                  <span>{rankProgress.current.toLocaleString()} / {rankProgress.target.toLocaleString()} Followers</span>
                )}
              </div>
              <Progress
                value={rankProgress.percentage}
                className="h-2 bg-white/20 [&>div]:bg-white"
              />
            </div>
          </div>
        )}
      </motion.div>

      {user.account_type === 'business' ? (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Business Balance
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${(user?.business_balance || 0).toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                Available to fund campaigns
              </p>
              <Link to={createPageUrl("BusinessFunding")} className="mt-4 block">
                <Button className="w-full bg-[var(--cashlap-blue)] hover:opacity-90 text-white">
                  <Plus className="mr-2 h-4 w-4" /> Add Funds
                </Button>
              </Link>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Link to={createPageUrl("CampaignManager")}>
              <Card className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-4 text-center">
                  <Plus className="w-8 h-8 mx-auto mb-3 text-[var(--cashlap-blue)]" />
                  <p className="font-medium">Create Campaign</p>
                </CardContent>
              </Card>
            </Link>

            <Link to={createPageUrl("BusinessAnalytics")}>
              <Card className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-4 text-center">
                  <BarChart2 className="w-8 h-8 mx-auto mb-3 text-[var(--cashlap-pink)]" />
                  <p className="font-medium">View Analytics</p>
                </CardContent>
              </Card>
            </Link>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Campaigns</CardTitle>
            </CardHeader>
            <CardContent>
              {campaigns.length === 0 ? (
                <div className="text-center py-8">
                  <Target className="w-12 h-12 mx-auto mb-3 text-gray-500" />
                  <p className="text-gray-700 mb-4">No campaigns yet</p>
                  <Link to={createPageUrl("CampaignManager")}>
                    <Button className="bg-[var(--cashlap-blue)] hover:opacity-90 text-white">
                      Create Your First Campaign
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {campaigns.slice(0, 3).map((campaign) => (
                    <div key={campaign.id} className="p-4 bg-gray-50 rounded-xl">
                      <h3 className="font-semibold text-gray-900">{campaign.title}</h3>
                      <p className="text-gray-700 mt-1">{campaign.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="bg-[var(--cashlap-green)]/20 text-green-800">
                          ${campaign.reward_amount}
                        </Badge>
                        <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                          {campaign.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {campaigns.length > 3 && (
                    <Link to={createPageUrl("CampaignManager")}>
                      <Button variant="ghost" className="w-full mt-2">
                        View All Campaigns
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-[var(--cashlap-yellow)]" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-gray-900">${(user?.total_earnings || 0).toFixed(2)}</p>
                    <p className="text-gray-700">Available Balance</p>
                  </div>
                </div >
                <Button
                  onClick={() => setShowWithdrawModal(true)}
                  className="bg-[var(--cashlap-yellow)] hover:opacity-90 text-white"
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Withdraw
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-4">
            <Card className="text-center">
              <CardContent className="p-4">
                <Target className="w-6 h-6 mx-auto mb-2 text-[var(--cashlap-orange)]" />
                <p className="text-2xl font-bold text-gray-900">{user?.missions_completed || 0}</p>
                <p className="text-sm text-gray-700">Missions</p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="p-4">
                <Star className="w-6 h-6 mx-auto mb-2 text-[var(--cashlap-yellow)]" />
                <p className="text-2xl font-bold text-gray-900">{user?.level || 1}</p>
                <p className="text-sm text-gray-700">Level</p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="p-4">
                <TrendingUp className="w-6 h-6 mx-auto mb-2 text-[var(--cashlap-green)]" />
                <p className="text-2xl font-bold text-gray-900">{activeMissions.length}</p>
                <p className="text-sm text-gray-700">Active</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Active Missions</CardTitle>
                <Link to={createPageUrl("Explore")}>
                  <Button variant="ghost" size="sm">
                    View All
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeMissions.length === 0 ? (
                <div className="text-center py-8">
                  <Gift className="w-12 h-12 mx-auto mb-3 text-gray-500" />
                  <p className="text-gray-700 mb-4">No active missions</p>
                  <Link to={createPageUrl("Explore")}>
                    <Button className="bg-[var(--cashlap-green)] hover:opacity-90 text-white">
                      Find Missions
                    </Button>
                  </Link>
                </div>
              ) : (
                activeMissions.slice(0, 3).map((mission) => (
                  <div
                    key={mission.id}
                    className="p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100"
                    onClick={() => handleMissionClick(mission)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-[var(--cashlap-orange)] rounded-xl flex items-center justify-center">
                        <MapPin className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{mission.title}</h3>
                        <p className="text-gray-700 mt-1">
                          {missionBusinesses[mission.business_id] || 'Business'}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <Badge variant="secondary" className="bg-[var(--cashlap-yellow)]/20 text-yellow-800">
                            ${mission.reward_amount}
                          </Badge>
                          <div className="flex items-center gap-1 text-sm text-gray-700">
                            <Camera className="w-3 h-3" />
                            <span>Tap to continue</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
              {activeMissions.length > 3 && (
                <div className="text-center pt-2">
                  <Link to={createPageUrl("Explore")}>
                    <Button variant="ghost">
                      View {activeMissions.length - 3} more active missions
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {recentMissions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentMissions.map((mission) => (
                  <div key={mission.id} className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Star className="w-5 h-5 text-[var(--cashlap-green)]" />
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <p className="font-medium text-gray-900 truncate">{mission.title}</p>
                      <p className="text-gray-700 text-sm truncate">
                        {missionBusinesses[mission.business_id] || 'Business'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {mission.status === 'approved' ? (
                          <p className="font-semibold text-[var(--cashlap-green)]">+${mission.reward_amount}</p>
                      ) : (
                          <p className="font-semibold text-red-500">$0.00</p>
                      )}
                      <p className="text-sm text-gray-600 capitalize">{mission.status}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <AnimatePresence>
        {showWithdrawModal && user && (
          <WithdrawModal 
            user={user} 
            onClose={() => setShowWithdrawModal(false)} 
            onSuccess={handleWithdrawSuccess}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Dashboard() {
  return (
    <AuthGuard
      requireAuth={true}
      fallbackUrl="Onboarding"
    >
      <DashboardContent />
    </AuthGuard>
  );
}