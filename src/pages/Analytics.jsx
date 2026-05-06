import { useState, useEffect, useCallback } from "react";
import { Business, Mission, User } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp,
  MapPin,
  Star,
  Calendar,
  Target,
  Coins,
  Camera,
  Trophy
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import AuthGuard from "@/components/auth/AuthGuard";

function AnalyticsContent() {
  const [user, setUser] = useState(null);
  const [userMissions, setUserMissions] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Memoize loadData using useCallback. It no longer needs to depend on `user`
  // as the initial loading state is managed by the caller (initial useEffect)
  // and subsequent calls don't need to show a full loader.
  const loadData = useCallback(async (isInitialCall = false, retryCount = 0) => {
    const maxRetries = 2;

    // Only show loader if it's the very initial call to loadData
    if (isInitialCall) {
      setLoading(true);
    }

    try {
      const currentUser = await User.me();
      setUser(currentUser);

      const missions = await Mission.filter({ user_id: currentUser.id }, '-created_date');
      setUserMissions(missions);

      const businessList = await Business.list();
      setBusinesses(businessList);
    } catch (error) {
      console.error("Error loading data:", error);

      const isNetworkError = error.message && (
        error.message.includes('Network Error') ||
        error.message.includes('fetch') ||
        error.message.includes('Failed to fetch') ||
        error.message.includes('NetworkError') ||
        error.message.includes('Connection') ||
        error.code === 'NETWORK_ERROR'
      );

      if (isNetworkError && retryCount < maxRetries) {
        console.warn(`Network connectivity issue in Analytics. Retrying ${retryCount + 1}/${maxRetries}...`);
        setTimeout(() => {
          // Pass the isInitialCall flag to retries if they are part of the initial loading sequence
          loadData(isInitialCall, retryCount + 1);
        }, (retryCount + 1) * 2000);
      } else {
        // Fallback for demo user if data loading fails persistently
        setUser({ id: 'demo-user', account_type: 'player' });
      }
    } finally {
      // Only turn off the loader after the initial load is complete
      if (isInitialCall) {
        setLoading(false);
      }
    }
  }, [setUser, setUserMissions, setBusinesses, setLoading]); // State setters are stable and don't cause re-renders of loadData itself

  useEffect(() => {
    // Call loadData for the initial fetch, setting isInitialCall to true
    loadData(true);

    // Set up a periodic refresh that only runs when the user is inactive
    const refreshInterval = setInterval(() => {
      const lastInteraction = localStorage.getItem('last_user_interaction');
      const now = Date.now();

      // Only refresh if the user has been inactive for at least 2 minutes
      // Pass isInitialCall as false for background refreshes
      if (lastInteraction && (now - parseInt(lastInteraction)) < 2 * 60 * 1000) {
        console.log('User is active, skipping analytics refresh.');
        return;
      }
      console.log('User is inactive, performing background analytics refresh...');
      loadData(false); // No loader for background refresh
    }, 60000); // Refresh every 60 seconds if inactive

    return () => clearInterval(refreshInterval);
  }, [loadData]); // loadData is now stable, so it's safe to be a dependency here

  // This effect tracks any user interaction on the page to determine activity
  useEffect(() => {
    const updateInteractionTime = () => {
      localStorage.setItem('last_user_interaction', Date.now().toString());
    };

    const events = ['click', 'scroll', 'keydown', 'touchstart'];
    events.forEach(event => document.addEventListener(event, updateInteractionTime, { passive: true }));

    return () => events.forEach(event => document.removeEventListener(event, updateInteractionTime));
  }, []);

  const getPlayerStats = () => {
    const completedMissions = userMissions.filter(m => m.status === 'approved');
    const activeMissions = userMissions.filter(m => m.status === 'active');
    const totalEarnings = completedMissions.reduce((sum, m) => sum + (m.final_reward_amount || m.reward_amount || 0), 0);
    const averageRating = completedMissions.filter(m => m.rating).reduce((sum, m) => sum + m.rating, 0) / completedMissions.filter(m => m.rating).length || 0;

    const categoryStats = {};
    completedMissions.forEach(mission => {
      const business = businesses.find(b => b.id === mission.business_id);
      if (business && business.category) {
        categoryStats[business.category] = (categoryStats[business.category] || 0) + 1;
      }
    });

    return {
      totalMissions: userMissions.length,
      completedMissions: completedMissions.length,
      activeMissions: activeMissions.length,
      totalEarnings,
      averageRating,
      categoryStats
    };
  };

  const getRecentActivity = () => {
    return userMissions
      .filter(m => m.status === 'approved')
      .sort((a, b) => new Date(b.submitted_at || b.updated_date) - new Date(a.submitted_at || a.updated_date))
      .slice(0, 10);
  };

  const getTopCategories = () => {
    const stats = getPlayerStats();
    return Object.entries(stats.categoryStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-20 bg-gray-200 rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-24 bg-gray-200 rounded-xl animate-pulse" />
          <div className="h-24 bg-gray-200 rounded-xl animate-pulse" />
        </div>
        <div className="h-40 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  const stats = getPlayerStats();
  const recentActivity = getRecentActivity();
  const topCategories = getTopCategories();

  return (
    <div className="p-4 space-y-6 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[var(--cashlap-green)] rounded-2xl p-4 sm:p-6 text-white"
      >
        <div className="flex items-center gap-3">
          <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8" />
          <div>
            <h1 className="text-lg sm:text-xl font-bold">My Analytics</h1>
            <p className="text-white/80 text-sm sm:text-base">Track your engagement and earnings</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[var(--cashlap-yellow)]/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <Coins className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--cashlap-yellow)]" />
            </div>
            <p className="text-lg sm:text-2xl font-bold text-gray-900">${stats.totalEarnings.toFixed(2)}</p>
            <p className="text-xs sm:text-sm text-gray-500">Total Earned</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[var(--cashlap-orange)]/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <Target className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--cashlap-orange)]" />
            </div>
            <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.completedMissions}</p>
            <p className="text-xs sm:text-sm text-gray-500">Completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[var(--cashlap-pink)]/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--cashlap-pink)]" />
            </div>
            <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.activeMissions}</p>
            <p className="text-xs sm:text-sm text-gray-500">Active Now</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[var(--cashlap-yellow)]/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <Star className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--cashlap-yellow)]" />
            </div>
            <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.averageRating > 0 ? stats.averageRating.toFixed(1) : 'N/A'}</p>
            <p className="text-xs sm:text-sm text-gray-500">Avg Rating</p>
          </CardContent>
        </Card>
      </div>

      {topCategories.length > 0 && (
        <Card>
          <CardHeader className="p-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--cashlap-orange)]" />
              Your Favorite Categories
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            {topCategories.map((item, index) => (
              <motion.div
                key={item.category}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-[var(--cashlap-green)] to-[var(--cashlap-yellow)] rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 capitalize text-sm sm:text-base">{item.category}</p>
                  <p className="text-xs sm:text-sm text-gray-500">{item.count} missions completed</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1">
                    <Target className="w-3 h-3 sm:w-4 sm:h-4 text-[var(--cashlap-green)]" />
                    <span className="text-sm sm:text-base font-semibold text-[var(--cashlap-green)]">{item.count}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="p-4">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--cashlap-green)]" />
            Recent Completed Missions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          {recentActivity.length === 0 ? (
            <div className="text-center py-6 sm:py-8">
              <Camera className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 text-gray-400" />
              <p className="text-gray-500 text-sm sm:text-base">No completed missions yet</p>
            </div>
          ) : (
            recentActivity.map((mission, index) => {
              const business = businesses.find(b => b.id === mission.business_id);
              return (
                <motion.div
                  key={mission.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
                >
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[var(--cashlap-green)]/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--cashlap-green)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm sm:text-base truncate">{mission.title}</p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1">
                      <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-500">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">{business?.name || 'Business'}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-500">
                        <Calendar className="w-3 h-3" />
                        {(mission.submitted_at || mission.updated_date) && format(new Date(mission.submitted_at || mission.updated_date), 'MMM d, HH:mm')}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-[var(--cashlap-green)] text-sm sm:text-base">+${(mission.final_reward_amount || mission.reward_amount || 0).toFixed(2)}</p>
                    {mission.rating && (
                      <div className="flex items-center gap-1 text-xs sm:text-sm justify-end">
                        <Star className="w-3 h-3 text-[var(--cashlap-yellow)] fill-current" />
                        <span>{mission.rating}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Analytics() {
  return (
    <AuthGuard
      requiredAccountType="player"
      requireAuth={true}
      fallbackUrl="Dashboard"
    >
      <AnalyticsContent />
    </AuthGuard>
  );
}