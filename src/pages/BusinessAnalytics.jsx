
import { useState, useEffect, useCallback } from "react";
import { User, Campaign, Mission } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import AuthGuard from "@/components/auth/AuthGuard";

// Combined lucide-react imports: existing used + new ones from outline
import {
  TrendingUp,
  Target,
  BarChart2,
  Loader2, // For loading spinner
  AlertTriangle, // For potential error/no data messages
  Zap, // Used for Conversion Rates
  PieChart as PieChartIcon // Used for Category Distribution
} from "lucide-react";

import { motion } from "framer-motion";

import {
  format,
  subDays,
  startOfWeek,
  endOfWeek,
  addDays,
  startOfMonth,
  endOfMonth
} from 'date-fns';

// Kept all original recharts imports as they are used in the preserved rendering logic
import {
  ResponsiveContainer,
  AreaChart,
  BarChart,
  PieChart as RechartsPieChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Area,
  Bar,
  Pie,
  Cell
} from 'recharts';

const CACHE_KEY = 'business_analytics_cache';

const CHART_COLORS = ["var(--cashlap-blue)", "var(--cashlap-green)", "var(--cashlap-yellow)", "var(--cashlap-orange)", "var(--cashlap-pink)"];

function BusinessAnalyticsContent() {
  const [user, setUser] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [missions, setMissions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('all');

  // Effect to load initial raw data (user, campaigns, missions)
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const currentUser = await User.me();
        // The AuthGuard component now handles the redirection for unauthorized access.
        // So, this specific check for account_type and business_id is no longer needed here.
        setUser(currentUser);

        // Load campaigns with validation
        const userCampaigns = await Campaign.filter({ business_id: currentUser.business_id }, '-created_date');
        
        // Validate campaigns belong to this business
        const validatedCampaigns = userCampaigns.filter(campaign => 
          campaign.business_id === currentUser.business_id
        );
        setCampaigns(validatedCampaigns);

        // Load missions with validation - only missions for this business's campaigns
        const businessMissions = await Mission.filter({ business_id: currentUser.business_id });
        
        // Additional validation: ensure missions are for valid campaigns
        const campaignIds = new Set(validatedCampaigns.map(c => c.id));
        const validatedMissions = businessMissions.filter(mission => 
          mission.business_id === currentUser.business_id &&
          campaignIds.has(mission.campaign_id)
        );
        setMissions(validatedMissions);
        
      } catch (error) {
        console.error("Error loading analytics data:", error);
        // Original behavior was redirect on error, preserving that functionality
        // However, with AuthGuard, this redirect might be redundant unless it's a *data loading* error, not an auth error.
        // For now, keep as fallback.
        window.location.href = createPageUrl('Dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadData();
    
    const refreshInterval = setInterval(() => {
      loadData();
    }, 60000);
    
    return () => clearInterval(refreshInterval);
  }, []); // Removed 'timeframe' from here as this effect is for initial data load and refresh, not dependent on the selected timeframe for its data fetch.

  const getAnalyticsData = useCallback(() => {
    const totalCampaigns = campaigns.length;
    const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
    const totalParticipants = campaigns.reduce((sum, c) => sum + (c.current_participants || 0), 0);
    const totalSpent = campaigns.reduce((sum, c) => sum + (c.reward_amount * (c.current_participants || 0)), 0);
    const averageCostPerParticipant = totalParticipants > 0 ? totalSpent / totalParticipants : 0;

    // Calculate traffic impact if baseline is available
    const baselineTraffic = user?.average_daily_traffic || 0;
    const cashlpVisits = totalParticipants; // Simplified - could be more sophisticated
    const trafficIncrease = baselineTraffic > 0 ? ((cashlpVisits / baselineTraffic) * 100) : 0;

    const campaignPerformanceData = campaigns.map(campaign => ({
      title: campaign.title,
      participants: campaign.current_participants || 0,
      spent: campaign.reward_amount * (campaign.current_participants || 0)
    }));

    // `missions` state now already contains only business-specific missions.
    // This filter ensures missions are linked to currently loaded campaigns for robustness.
    const businessCampaignIds = new Set(campaigns.map(c => c.id));
    const relevantMissions = missions.filter(m => businessCampaignIds.has(m.campaign_id));

    const totalCompletedMissions = relevantMissions.filter(m => m.status === 'completed' || m.status === 'verified').length;
    const overallConversionRate = totalParticipants > 0 ? (totalCompletedMissions / totalParticipants) * 100 : 0;

    const campaignConversionData = campaigns.map(campaign => {
        const completedMissionsForCampaign = relevantMissions.filter(m =>
            m.campaign_id === campaign.id && (m.status === 'completed' || m.status === 'verified')
        ).length;

        const participants = campaign.current_participants || 0;

        const conversionRate = participants > 0
            ? (completedMissionsForCampaign / participants) * 100
            : 0;

        return {
            name: campaign.title,
            conversion: parseFloat(conversionRate.toFixed(1))
        };
    }).sort((a, b) => b.conversion - a.conversion).slice(0, 5);


    const dailyParticipants = {};
    relevantMissions.forEach(mission => {
      const dateToUse = mission.completed_date || mission.created_date;
      if (dateToUse) {
        const date = format(new Date(dateToUse), 'yyyy-MM-dd');
        dailyParticipants[date] = (dailyParticipants[date] || 0) + 1;
      }
    });

    let startDate;
    let endDate = new Date();

    switch (timeframe) {
      case '7d':
        startDate = subDays(endDate, 6);
        break;
      case '30d':
        startDate = subDays(endDate, 29);
        break;
      case 'this_week':
        startDate = startOfWeek(endDate, { weekStartsOn: 1 });
        endDate = endOfWeek(endDate, { weekStartsOn: 1 });
        break;
      case 'this_month':
        startDate = startOfMonth(endDate);
        endDate = endOfMonth(endDate);
        break;
      case 'all':
        // For 'all time', find the earliest and latest mission dates
        if (relevantMissions.length > 0) {
          const allMissionDates = relevantMissions.map(m => new Date(m.completed_date || m.created_date)).filter(d => !isNaN(d.getTime()));
          if (allMissionDates.length > 0) {
            startDate = new Date(Math.min(...allMissionDates.map(d => d.getTime())));
            endDate = new Date(Math.max(...allMissionDates.map(d => d.getTime())));
          } else {
            // Fallback if no missions or invalid dates, same as default
            startDate = subDays(new Date(), 29);
            endDate = new Date();
          }
        } else {
          // If no relevant missions, use default 30-day window
          startDate = subDays(new Date(), 29);
          endDate = new Date();
        }
        break;
      default: // Fallback for any unhandled timeframe values
        startDate = subDays(endDate, 29);
        break;
    }

    const timeSeriesData = [];
    let currentDate = startDate;
    // Ensure loop correctly handles cases where startDate might be after endDate (e.g., no data, or single day range)
    while (currentDate <= endDate) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      timeSeriesData.push({
        date: format(currentDate, 'MMM d'),
        participants: dailyParticipants[dateStr] || 0
      });
      currentDate = addDays(currentDate, 1);
    }
    // If timeSeriesData is still empty, and there's at least one valid day in the range, add it.
    // This handles the edge case where startDate and endDate might be the same, and the loop runs once.
    if (timeSeriesData.length === 0 && startDate && endDate && startDate.getTime() <= endDate.getTime()) {
        const dateStr = format(startDate, 'yyyy-MM-dd');
        timeSeriesData.push({
            date: format(startDate, 'MMM d'),
            participants: dailyParticipants[dateStr] || 0
        });
    }


    const categoryCounts = {};
    campaigns.forEach(campaign => {
      const category = campaign.category || 'Uncategorized';
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    const categoryDistributionData = Object.keys(categoryCounts).map(category => ({
      name: category,
      value: categoryCounts[category]
    }));

    return {
      totalCampaigns,
      activeCampaigns,
      totalParticipants,
      totalSpent,
      averageCostPerParticipant,
      baselineTraffic,
      cashlpVisits,
      trafficIncrease,
      campaignPerformanceData,
      timeSeriesData,
      categoryDistributionData,
      overallConversionRate,
      campaignConversionData
    };
  }, [campaigns, missions, user, timeframe]);

  // Effect to recalculate analytics data when raw data (campaigns, missions) or timeframe changes
  // This ensures analytics is always in sync with fetched data and selected timeframe
  useEffect(() => {
    // Only calculate if not loading and data is present, or if it finished loading and there's no data
    if (!loading && (campaigns.length > 0 || missions.length > 0)) {
      const data = getAnalyticsData();
      setAnalytics(data);
    } else if (!loading && campaigns.length === 0 && missions.length === 0) {
      // If no data is loaded (and not loading), ensure analytics is reset to empty/default values
      setAnalytics({
        totalCampaigns: 0,
        activeCampaigns: 0,
        totalParticipants: 0,
        totalSpent: 0,
        averageCostPerParticipant: 0,
        baselineTraffic: user?.average_daily_traffic || 0, // Still depends on user object
        cashlpVisits: 0,
        trafficIncrease: 0,
        campaignPerformanceData: [],
        timeSeriesData: [],
        categoryDistributionData: [],
        overallConversionRate: 0,
        campaignConversionData: []
      });
    }
  }, [campaigns, missions, loading, user, getAnalyticsData]); // Dependencies include getAnalyticsData now that it's a useCallback

  // Modified loading state rendering to use Loader2 as per new imports
  if (loading || !analytics) { // Check for loading OR if analytics hasn't been calculated yet
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-gray-500">
        <Loader2 className="h-10 w-10 animate-spin text-[var(--cashlap-blue)] mb-4" />
        <p>Loading analytics data...</p>
      </div>
    );
  }

  // Handle case where analytics data is loaded but campaigns or participants are zero
  if (analytics.totalCampaigns === 0 && analytics.totalParticipants === 0) {
    return (
      <div className="p-4 space-y-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[var(--cashlap-blue)] rounded-2xl p-4 sm:p-6 text-white"
        >
          <div className="flex items-center justify-center gap-3">
            <BarChart2 className="w-6 h-6 sm:w-8 sm:h-8" />
            <div>
              <h1 className="text-lg sm:text-xl font-bold">Business Analytics</h1>
              <p className="text-white/80 text-sm sm:text-base">Track your campaign performance</p>
            </div>
          </div>
        </motion.div>
        <div className="flex flex-col items-center justify-center min-h-[30vh] text-gray-500">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Data Available</h2>
          <p className="text-md mb-4">It looks like you haven't launched any campaigns or had participants yet.</p>
          <p className="text-md mb-6">Start by <Link to={createPageUrl('CampaignCreate')} className="text-[var(--cashlap-blue)] hover:underline">creating your first campaign</Link>!</p>
        </div>
      </div>
    );
  }

  // Destructure from analytics state variable (instead of direct getAnalyticsData() call)
  const {
    totalCampaigns,
    activeCampaigns,
    totalParticipants,
    totalSpent,
    campaignPerformanceData,
    timeSeriesData,
    categoryDistributionData,
    baselineTraffic,
    cashlpVisits,
    trafficIncrease,
    overallConversionRate,
    campaignConversionData
  } = analytics;

  return (
    <div className="p-4 space-y-6 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[var(--cashlap-blue)] rounded-2xl p-4 sm:p-6 text-white"
      >
        <div className="flex items-center gap-3">
          <BarChart2 className="w-6 h-6 sm:w-8 sm:h-8" />
          <div>
            <h1 className="text-lg sm:text-xl font-bold">Business Analytics</h1>
            <p className="text-white/80 text-sm sm:text-base">Track your campaign performance</p>
          </div>
        </div>
      </motion.div>

      {/* Traffic Impact section, only rendered if baselineTraffic > 0 */}
      {baselineTraffic > 0 && (
        <Card>
          <CardHeader className="p-3 sm:p-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--cashlap-green)]" />
              Traffic Impact
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{baselineTraffic}</p>
                <p className="text-xs text-gray-500">Daily Baseline</p>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-[var(--cashlap-blue)]">{cashlpVisits}</p>
                <p className="text-xs text-gray-500">CashLap Visits</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-[var(--cashlap-green)]">+{trafficIncrease.toFixed(1)}%</p>
                <p className="text-xs text-gray-500">Traffic Boost</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="p-3 sm:p-4 pb-0">
            <CardTitle className="text-sm font-medium text-gray-500">Total Campaigns</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-2">
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{totalCampaigns}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 sm:p-4 pb-0">
            <CardTitle className="text-sm font-medium text-gray-500">Active Campaigns</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-2">
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{activeCampaigns}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 sm:p-4 pb-0">
            <CardTitle className="text-sm font-medium text-gray-500">Total Participants</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-2">
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{totalParticipants}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 sm:p-4 pb-0">
            <CardTitle className="text-sm font-medium text-gray-500">Total Spent</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-2">
            <p className="text-xl sm:text-2xl font-bold text-gray-900">${totalSpent.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Participants Over Time Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--cashlap-blue)]" />
            Participants Over Time
          </CardTitle>
          {/* Timeframe Selection Buttons */}
          <div className="flex flex-wrap gap-2 mt-2">
            <Button size="sm" variant={timeframe === '7d' ? 'default' : 'outline'} onClick={() => setTimeframe('7d')} className={`${timeframe === '7d' ? 'bg-[var(--cashlap-blue)] text-white hover:bg-[var(--cashlap-blue)]/90' : 'text-gray-700 hover:bg-gray-100'}`}>7D</Button>
            <Button size="sm" variant={timeframe === '30d' ? 'default' : 'outline'} onClick={() => setTimeframe('30d')} className={`${timeframe === '30d' ? 'bg-[var(--cashlap-blue)] text-white hover:bg-[var(--cashlap-blue)]/90' : 'text-gray-700 hover:bg-gray-100'}`}>30D</Button>
            <Button size="sm" variant={timeframe === 'this_week' ? 'default' : 'outline'} onClick={() => setTimeframe('this_week')} className={`${timeframe === 'this_week' ? 'bg-[var(--cashlap-blue)] text-white hover:bg-[var(--cashlap-blue)]/90' : 'text-gray-700 hover:bg-gray-100'}`}>Week</Button>
            <Button size="sm" variant={timeframe === 'this_month' ? 'default' : 'outline'} onClick={() => setTimeframe('this_month')} className={`${timeframe === 'this_month' ? 'bg-[var(--cashlap-blue)] text-white hover:bg-[var(--cashlap-blue)]/90' : 'text-gray-700 hover:bg-gray-100'}`}>Month</Button>
            <Button size="sm" variant={timeframe === 'all' ? 'default' : 'outline'} onClick={() => setTimeframe('all')} className={`${timeframe === 'all' ? 'bg-[var(--cashlap-blue)] text-white hover:bg-[var(--cashlap-blue)]/90' : 'text-gray-700 hover:bg-gray-100'}`}>All Time</Button>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={timeSeriesData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="colorParticipants" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--cashlap-blue)" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="var(--cashlap-blue)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="participants" stroke="var(--cashlap-blue)" fill="url(#colorParticipants)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Campaign Performance Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Target className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--cashlap-blue)]" />
            Campaign Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={campaignPerformanceData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="title" width={100} tick={{ fontSize: 12, wordWrap: 'break-word', width: 100 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="participants" fill="var(--cashlap-blue)" name="Participants" />
              <Bar dataKey="spent" fill="var(--cashlap-green)" name="Spent ($)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Conversion Rates Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--cashlap-pink)]" />
            Conversion Rates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center p-3 bg-pink-50 rounded-lg">
            <p className="text-2xl font-bold text-[var(--cashlap-pink)]">{overallConversionRate.toFixed(1)}%</p>
            <p className="text-xs text-gray-500">Overall Conversion Rate</p>
            <p className="text-xs text-gray-500 mt-1">(Completed Missions / Participants)</p>
          </div>

          <h4 className="text-sm font-medium text-gray-600 pt-2 border-t">Top 5 Campaigns by Conversion</h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={campaignConversionData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} tickFormatter={(tick) => `${tick}%`} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, wordWrap: 'break-word', width: 100 }} />
              <Tooltip formatter={(value) => [`${value}%`, "Conversion"]} />
              <Bar dataKey="conversion" name="Conversion Rate" fill="var(--cashlap-pink)" background={{ fill: '#eee' }} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Category Distribution Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <PieChartIcon className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--cashlap-orange)]" />
            Category Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <RechartsPieChart>
              <Pie data={categoryDistributionData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5}>
                {categoryDistributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [`${value} campaigns`, name]} />
              <Legend />
            </RechartsPieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

export default function BusinessAnalytics() {
  return (
    <AuthGuard 
      requiredAccountType="business" 
      requireAuth={true}
      requireBusinessId={true}
      fallbackUrl="Dashboard"
    >
      <BusinessAnalyticsContent />
    </AuthGuard>
  );
}
