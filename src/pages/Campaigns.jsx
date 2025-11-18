import { useState, useEffect } from "react";
import { User, Campaign, Business, Mission } from "@/entities/all";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import AuthGuard from "@/components/auth/AuthGuard";
import {
  Target,
  Plus,
  Play,
  Pause,
  BarChart3,
  Users,
  DollarSign,
  Calendar,
  MapPin,
  Loader2,
  Eye,
  Edit,
  Activity,
  Clock,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createPageUrl } from "@/utils";

function CampaignsContent() {
  const [user, setUser] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [business, setBusiness] = useState(null);
  const [submissionCounts, setSubmissionCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      if (!currentUser.business_id) {
        setError("No business profile found. Please complete your profile setup.");
        setLoading(false);
        return;
      }

      const [businessData, userCampaigns] = await Promise.all([
        Business.get(currentUser.business_id),
        Campaign.filter({ business_id: currentUser.business_id }, '-created_date')
      ]);

      setBusiness(businessData);
      setCampaigns(userCampaigns);

      // Get submission counts for each campaign
      const campaignIds = userCampaigns.map(c => c.id);
      if (campaignIds.length > 0) {
        const pendingMissions = await Mission.filter({ 
          campaign_id: { $in: campaignIds }, 
          status: 'submitted' 
        });
        const counts = pendingMissions.reduce((acc, mission) => {
          acc[mission.campaign_id] = (acc[mission.campaign_id] || 0) + 1;
          return acc;
        }, {});
        setSubmissionCounts(counts);
      }

    } catch (error) {
      console.error("Error loading campaigns data:", error);
      setError("Failed to load campaigns. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  const toggleCampaignStatus = async (campaign) => {
    try {
      const newStatus = campaign.status === 'active' ? 'paused' : 'active';
      await Campaign.update(campaign.id, { status: newStatus });
      loadData();
    } catch (error) {
      console.error("Error toggling campaign status:", error);
      setError(`Failed to update campaign status: ${error.message}`);
      setTimeout(() => setError(''), 5000);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />;
      case 'paused': return <Pause className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-600" />;
      case 'completed': return <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />;
      default: return <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-50 text-green-700 border-green-200';
      case 'paused': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'completed': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const filteredCampaigns = campaigns.filter(campaign => {
    if (selectedFilter === 'all') return true;
    return campaign.status === selectedFilter;
  });

  const campaignStats = {
    total: campaigns.length,
    active: campaigns.filter(c => c.status === 'active').length,
    paused: campaigns.filter(c => c.status === 'paused').length,
    totalParticipants: campaigns.reduce((sum, c) => sum + (c.current_participants || 0), 0),
    totalSpent: campaigns.reduce((sum, c) => sum + (c.reward_amount * (c.current_participants || 0)), 0)
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm w-full">
          <Loader2 className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-4 text-blue-600 animate-spin" />
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Loading campaigns</h3>
          <p className="text-sm sm:text-base text-gray-600">Please wait while we fetch your data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-red-200 shadow-lg">
          <CardContent className="p-6 sm:p-8 text-center">
            <XCircle className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-red-500" />
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Something went wrong</h3>
            <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">{error}</p>
            <Button onClick={() => window.location.reload()} className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 truncate">Campaign Management</h1>
              <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600 line-clamp-2">
                Manage and monitor your marketing campaigns for {business?.name || 'your business'}
              </p>
            </div>
            <div className="flex-shrink-0">
              <Link to={createPageUrl("CampaignManager")}>
                <Button className="bg-blue-600 hover:bg-blue-700 shadow-sm w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Create Campaign</span>
                  <span className="sm:hidden">Create</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-white shadow-sm border-0 hover:shadow-md transition-shadow duration-200">
              <CardContent className="p-3 sm:p-4 lg:p-6">
                <div className="flex items-center">
                  <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg flex-shrink-0">
                    <Target className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-blue-600" />
                  </div>
                  <div className="ml-2 sm:ml-3 lg:ml-4 min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Total Campaigns</p>
                    <p className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900">{campaignStats.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-white shadow-sm border-0 hover:shadow-md transition-shadow duration-200">
              <CardContent className="p-3 sm:p-4 lg:p-6">
                <div className="flex items-center">
                  <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg flex-shrink-0">
                    <Activity className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-green-600" />
                  </div>
                  <div className="ml-2 sm:ml-3 lg:ml-4 min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Active</p>
                    <p className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900">{campaignStats.active}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white shadow-sm border-0 hover:shadow-md transition-shadow duration-200">
              <CardContent className="p-3 sm:p-4 lg:p-6">
                <div className="flex items-center">
                  <div className="p-1.5 sm:p-2 bg-purple-100 rounded-lg flex-shrink-0">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-purple-600" />
                  </div>
                  <div className="ml-2 sm:ml-3 lg:ml-4 min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Participants</p>
                    <p className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900">{campaignStats.totalParticipants.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-white shadow-sm border-0 hover:shadow-md transition-shadow duration-200">
              <CardContent className="p-3 sm:p-4 lg:p-6">
                <div className="flex items-center">
                  <div className="p-1.5 sm:p-2 bg-yellow-100 rounded-lg flex-shrink-0">
                    <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-yellow-600" />
                  </div>
                  <div className="ml-2 sm:ml-3 lg:ml-4 min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Total Spent</p>
                    <p className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900">${campaignStats.totalSpent.toFixed(0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Filter Tabs */}
        <div className="mb-4 sm:mb-6">
          <div className="border-b border-gray-200 overflow-x-auto">
            <nav className="-mb-px flex space-x-4 sm:space-x-8 min-w-max">
              {[
                { key: 'all', label: 'All', fullLabel: 'All Campaigns', count: campaignStats.total },
                { key: 'active', label: 'Active', fullLabel: 'Active', count: campaignStats.active },
                { key: 'paused', label: 'Paused', fullLabel: 'Paused', count: campaignStats.paused }
              ].map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setSelectedFilter(filter.key)}
                  className={`whitespace-nowrap pb-3 sm:pb-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 flex items-center ${
                    selectedFilter === filter.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="hidden sm:inline">{filter.fullLabel}</span>
                  <span className="sm:hidden">{filter.label}</span>
                  <span className={`ml-1 sm:ml-2 py-0.5 px-1.5 sm:px-2 rounded-full text-xs ${
                    selectedFilter === filter.key
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {filter.count}
                  </span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Campaigns List */}
        {filteredCampaigns.length === 0 ? (
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-8 sm:p-12 text-center">
              <Target className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                {selectedFilter === 'all' ? 'No campaigns yet' : `No ${selectedFilter} campaigns`}
              </h3>
              <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 max-w-md mx-auto">
                {selectedFilter === 'all' 
                  ? 'Create your first campaign to start engaging with customers and growing your business.'
                  : `You don't have any ${selectedFilter} campaigns at the moment.`
                }
              </p>
              <Link to={createPageUrl("CampaignManager")}>
                <Button className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Campaign
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            <AnimatePresence>
              {filteredCampaigns.map((campaign, index) => (
                <motion.div
                  key={campaign.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="bg-white shadow-sm border-0 hover:shadow-md transition-all duration-200">
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate flex-1 min-w-0">
                              {campaign.title}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(campaign.status)}`}>
                                {getStatusIcon(campaign.status)}
                                <span className="ml-1 capitalize">{campaign.status}</span>
                              </Badge>
                              {submissionCounts[campaign.id] > 0 && (
                                <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs">
                                  <span className="hidden sm:inline">{submissionCounts[campaign.id]} pending review{submissionCounts[campaign.id] !== 1 ? 's' : ''}</span>
                                  <span className="sm:hidden">{submissionCounts[campaign.id]} pending</span>
                                </Badge>
                              )}
                            </div>
                          </div>

                          {campaign.description && (
                            <p className="text-sm sm:text-base text-gray-600 mb-4 line-clamp-2">{campaign.description}</p>
                          )}

                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4 mb-4">
                            <div className="flex items-center text-xs sm:text-sm text-gray-600">
                              <DollarSign className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 text-green-600 flex-shrink-0" />
                              <span className="font-medium">${campaign.reward_amount}</span>
                              <span className="ml-1 hidden sm:inline">reward</span>
                            </div>
                            <div className="flex items-center text-xs sm:text-sm text-gray-600">
                              <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 text-blue-600 flex-shrink-0" />
                              <span className="font-medium">{campaign.current_participants || 0}</span>
                              <span className="ml-1 hidden sm:inline">participants</span>
                            </div>
                            <div className="flex items-center text-xs sm:text-sm text-gray-600">
                              <MapPin className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 text-purple-600 flex-shrink-0" />
                              <span className="font-medium">{campaign.locations?.length || 0}</span>
                              <span className="ml-1 hidden sm:inline">location{(campaign.locations?.length || 0) !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="flex items-center text-xs sm:text-sm text-gray-600">
                              <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 text-orange-600 flex-shrink-0" />
                              {campaign.start_date ? (
                                <span className="truncate">{new Date(campaign.start_date).toLocaleDateString()}</span>
                              ) : (
                                <span className="text-gray-400">No date</span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Link to={createPageUrl(`SubmissionReview?campaignId=${campaign.id}`)}>
                              <Button variant="outline" size="sm" className="hover:bg-gray-50 text-xs sm:text-sm">
                                <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                                <span className="hidden sm:inline">Review Submissions</span>
                                <span className="sm:hidden">Review</span>
                              </Button>
                            </Link>
                            
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => toggleCampaignStatus(campaign)}
                              className="hover:bg-gray-50 text-xs sm:text-sm"
                            >
                              {campaign.status === 'active' ? (
                                <>
                                  <Pause className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                                  Pause
                                </>
                              ) : (
                                <>
                                  <Play className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                                  <span className="hidden sm:inline">Activate</span>
                                  <span className="sm:hidden">Start</span>
                                </>
                              )}
                            </Button>

                            <Link to={createPageUrl("CampaignManager")}>
                              <Button variant="outline" size="sm" className="hover:bg-gray-50 text-xs sm:text-sm">
                                <Edit className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                                Edit
                              </Button>
                            </Link>

                            <Link to={createPageUrl(`CampaignAnalytics?id=${campaign.id}`)}>
                              <Button variant="outline" size="sm" className="hover:bg-gray-50 text-xs sm:text-sm">
                                <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                                <span className="hidden sm:inline">Analytics</span>
                                <span className="sm:hidden">Stats</span>
                              </Button>
                            </Link>
                          </div>
                        </div>

                        {campaign.image_url && (
                          <div className="flex-shrink-0 order-first lg:order-last">
                            <img
                              src={campaign.image_url}
                              alt={campaign.title}
                              className="w-full h-32 sm:w-16 sm:h-16 lg:w-20 lg:h-20 object-cover rounded-lg border border-gray-200"
                            />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Campaigns() {
  return (
    <AuthGuard
      requireAuth={true}
      requiredAccountType="business"
      fallbackUrl="Onboarding"
    >
      <CampaignsContent />
    </AuthGuard>
  );
}