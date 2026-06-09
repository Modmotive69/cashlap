/**
 * Dashboard.jsx — refactored
 * Data loading logic extracted to useDashboard() hook.
 * Business UI → BusinessDashboardContent
 * Player UI   → PlayerDashboardContent
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Coins, Star, MapPin, TrendingUp, Camera, ChevronRight,
  Target, Gift, LogOut, BarChart2, Plus, Users, DollarSign,
  Briefcase, User as UserIcon, Loader2, RefreshCw, AlertTriangle, Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import WithdrawModal from "@/components/dashboard/WithdrawModal";
import AuthGuard from "@/components/auth/AuthGuard";
import { toast } from 'sonner';
import { useDashboard } from "@/hooks/useDashboard";
import BusinessDashboardContent from "@/components/dashboard/BusinessDashboardContent";
import PlayerDashboardContent from "@/components/dashboard/PlayerDashboardContent";

const INFLUENCER_TIERS = {
  rookie:       { name: 'Rookie',       subtitle: 'Nano',     emoji: '🐣', description: 'Just starting their rise to fame.',               minFollowers: 0,        maxFollowers: 9999,     multiplier: 1.0,  color: '#94A3B8' },
  trendsetter:  { name: 'Trendsetter',  subtitle: 'Micro',    emoji: '🔥', description: 'Sparking buzz and gaining attention.',            minFollowers: 10000,    maxFollowers: 99999,    multiplier: 1.25, color: '#F97316' },
  vibe_curator: { name: 'Vibe Curator', subtitle: 'Mid-Tier', emoji: '🎶', description: 'Setting trends and building a loyal following.',  minFollowers: 100000,   maxFollowers: 999999,   multiplier: 1.5,  color: '#8B5CF6' },
  icon:         { name: 'Icon',         subtitle: 'Macro',    emoji: '🌟', description: 'Recognized everywhere, leading the scene.',       minFollowers: 1000000,  maxFollowers: 9999999,  multiplier: 2.0,  color: '#EAB308' },
  legend:       { name: 'Legend',       subtitle: 'Mega',     emoji: '👑', description: 'Elite status, cultural influencer, unstoppable.', minFollowers: 10000000, maxFollowers: Infinity, multiplier: 3.0,  color: '#DC2626' },
};

const RANK_ORDER = ['rookie', 'trendsetter', 'vibe_curator', 'icon', 'legend'];

function DashboardContent() {
  const {
    user, setUser, missions, missionBusinesses, business, campaigns,
    loading, error, setError, isRefreshing, isVerifyingPayment, loadData,
  } = useDashboard();

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  const handleWithdrawSuccess = (newBalance) => {
    setShowWithdrawModal(false);
    if (user) setUser({ ...user, total_earnings: newBalance });
  };

  const handleLogout = async () => {
    try {
      const { User } = await import('@/entities/all');
      await User.logout();
    } finally {
      window.location.reload();
    }
  };

  const handleMissionClick = (mission) => {
    if (!mission?.id) {
      toast.error("This mission's details are incomplete.");
      return;
    }
    window.location.href = `/MissionSubmission?missionId=${mission.id}`;
  };

  const getRankProgress = () => {
    if (!user || user.account_type !== 'player') return { percentage: 0, current: 0, target: 0, nextRankName: 'Trendsetter', isMaxRank: false };
    const currentRankKey = user.influencer_rank || 'rookie';
    const currentFollowers = user.total_followers || 0;
    const currentRankIndex = RANK_ORDER.indexOf(currentRankKey);
    const currentRankData = INFLUENCER_TIERS[currentRankKey];

    if (currentRankIndex === RANK_ORDER.length - 1) {
      return { percentage: 100, current: currentFollowers, target: currentFollowers, nextRankName: 'Legend', isMaxRank: true };
    }
    const nextRankKey = RANK_ORDER[currentRankIndex + 1];
    const nextRankData = INFLUENCER_TIERS[nextRankKey];
    const progressStart = currentRankData.minFollowers;
    const progressEnd = nextRankData.minFollowers;
    const followersInCurrentTier = Math.max(0, currentFollowers - progressStart);
    const followersNeededForNextTier = progressEnd - progressStart;
    let percentage = followersNeededForNextTier > 0
      ? (followersInCurrentTier / followersNeededForNextTier) * 100
      : currentFollowers >= progressEnd ? 100 : 0;
    percentage = Math.min(percentage, 100);
    return { percentage, current: currentFollowers, target: progressEnd, nextRankName: nextRankData.name, isMaxRank: false };
  };

  // Loading states
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
              <RefreshCw className="w-4 h-4 mr-2" /> Try Again
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
            <p className="text-sm text-gray-600 mb-4">Please check your connection and try again.</p>
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

  const getDynamicRank = (totalFollowers) => {
    for (const [key, tier] of Object.entries(INFLUENCER_TIERS)) {
      if (totalFollowers >= tier.minFollowers && totalFollowers <= tier.maxFollowers) return { key, ...tier };
    }
    return { key: 'rookie', ...INFLUENCER_TIERS.rookie };
  };

  const isPlayer = user.account_type === 'player';
  const dynamicRank = isPlayer ? getDynamicRank(user.total_followers || 0) : null;
  const rankData = isPlayer ? (dynamicRank || INFLUENCER_TIERS[user.influencer_rank || 'rookie']) : null;
  const rankProgress = isPlayer ? getRankProgress() : null;

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

      {/* Header row */}
      <div className="flex justify-between items-center">
        <Badge variant="outline" className={user.account_type === 'business'
          ? 'bg-blue-100 text-[var(--cashlap-blue)] border-blue-200'
          : 'bg-green-100 text-[var(--cashlap-green)] border-green-200'}>
          {user.account_type === 'business'
            ? <><Briefcase className="w-3 h-3 mr-1" />Business</>
            : <><UserIcon className="w-3 h-3 mr-1" />Player</>}
        </Badge>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => loadData(true)} disabled={isRefreshing} className="text-gray-600 hover:text-gray-800">
            {isRefreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-600 hover:text-gray-800">
            <LogOut className="w-4 h-4 mr-2" /> Log Out
          </Button>
        </div>
      </div>

      {/* Inline error banner */}
      {error && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <div>
                <p className="text-amber-800 text-sm">{error}</p>
                <Button variant="outline" size="sm" onClick={() => setError(null)} className="mt-2">Dismiss</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hero welcome card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-6 text-white"
        style={{
          background: user.account_type === 'business'
            ? 'var(--cashlap-blue)'
            : user.tiktok_id
              ? `linear-gradient(135deg, ${rankData.color} 0%, #4a5568 100%)`
              : 'linear-gradient(135deg, #4a5568 0%, #2d3748 100%)'
        }}
      >
        {user.account_type === 'business' ? (
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">
                {user.business_name || business?.name || "Business Dashboard"}
              </h2>
              <p className="text-blue-100 mt-1">Manage your campaigns and track performance</p>
            </div>
            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/8a050254a_20250612_0908_TranslucentGreenCube_remix_01jxj7f9waej1th5v95nhpaa9t.png"
              alt="CASH Mascot"
              className="w-20 h-20 object-contain"
            />
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-bold text-white leading-tight mb-3">{user.display_name || user.full_name}</h2>
            {!user.tiktok_id ? (
              <div className="bg-white/10 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🎵</span>
                  <div>
                    <p className="text-white font-semibold text-sm leading-tight">No Influencer Rank Yet</p>
                    <p className="text-white/70 text-xs leading-snug mt-0.5">Link your TikTok account to receive your Influencer Rank and unlock reward multipliers.</p>
                  </div>
                </div>
                <Link to={createPageUrl("Profile")} className="w-full">
                  <button className="w-full bg-white text-gray-900 font-semibold text-sm py-2 rounded-lg hover:bg-white/90 transition-colors">
                    Link TikTok Account
                  </button>
                </Link>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{rankData.emoji}</span>
                  <div>
                    <h3 className="text-xl font-bold text-white leading-tight">{rankData.name}</h3>
                    <p className="text-sm text-white/80 leading-tight">{rankData.subtitle} Influencer</p>
                  </div>
                </div>
                <p className="text-xs text-white/70 mt-2 max-w-[280px]">{rankData.description}</p>
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
                  <Progress value={rankProgress.percentage} className="h-2 bg-white/20 [&>div]:bg-white" />
                </div>
              </>
            )}
          </div>
        )}
      </motion.div>

      {/* Role-specific content */}
      {user.account_type === 'business' ? (
        <BusinessDashboardContent user={user} business={business} campaigns={campaigns} />
      ) : (
        <PlayerDashboardContent
          user={user}
          missions={missions}
          missionBusinesses={missionBusinesses}
          activeMissions={activeMissions}
          recentMissions={recentMissions}
          onWithdraw={() => setShowWithdrawModal(true)}
          onMissionClick={handleMissionClick}
        />
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
    <AuthGuard requireAuth={true} fallbackUrl="Onboarding">
      <DashboardContent />
    </AuthGuard>
  );
}
