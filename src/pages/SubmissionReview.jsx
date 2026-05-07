import { useState, useEffect, useCallback } from "react";
import { Campaign, Mission } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  X,
  ExternalLink,
  Calendar,
  User as UserIcon,
  Loader2,
  RefreshCw,
  ArrowLeft
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import AuthGuard from "@/components/auth/AuthGuard";
import { processMissionApproval } from "@/functions/processMissionApproval";
import { processMissionRejection } from "@/functions/processMissionRejection";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";

function SubmissionReviewContent() {
  const [campaign, setCampaign] = useState(null);
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingMissions, setProcessingMissions] = useState(new Set());
  const [rejectionReasons, setRejectionReasons] = useState({});

  // Get campaignId from URL parameters (handle both camelCase and lowercase)
  const urlParams = new URLSearchParams(window.location.search);
  const campaignId = urlParams.get('campaignId') || urlParams.get('campaignid');

  const loadSubmissionData = useCallback(async () => {
    // Validate campaignId parameter first
    if (!campaignId) {
      // This state will be handled by a specific return block before loading
      return; 
    }

    setLoading(true);
    setError('');
    
    try {
      console.log(`Loading submission review for campaign: ${campaignId}`);

      // Load campaign data
      const campaignData = await Campaign.get(campaignId);
      if (!campaignData) {
        throw new Error('Campaign not found. It may have been deleted or you may not have access to it.');
      }
      
      setCampaign(campaignData);

      // Load submitted missions for this campaign
      // It's assumed the Mission entity might already contain a reference to user data or we only need user_id.
      const submittedMissions = await Mission.filter(
        { 
          campaign_id: campaignId, 
          status: 'submitted' 
        }, 
        '-submitted_at'
      );
      
      console.log(`Found ${submittedMissions.length} submitted missions`);
      setMissions(submittedMissions);
      
    } catch (error) {
      console.error("Error loading submission review data:", error);
      setError(`Error loading submission review data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    if (campaignId) { // Only load if campaignId is present
      loadSubmissionData();
    } else {
      setLoading(false); // If no campaignId, we're not loading.
    }
  }, [loadSubmissionData, campaignId]);

  const handleApprove = async (mission) => {
    if (processingMissions.has(mission.id)) return;
    
    setProcessingMissions(prev => new Set(prev).add(mission.id));
    setError(''); // Clear previous error
    
    try {
      console.log(`Approving mission: ${mission.id}`);
      const result = await processMissionApproval({ missionId: mission.id });
      
      if (result.data?.success) {
        console.log('Mission approved successfully');
        // Remove from pending list
        setMissions(prev => prev.filter(m => m.id !== mission.id));
      } else {
        // Assume result.data?.error contains a user-friendly message
        throw new Error(result.data?.error || 'Approval failed');
      }
    } catch (error) {
      console.error('Error approving mission:', error);
      setError(`Failed to approve mission: ${error.message}`);
    } finally {
      setProcessingMissions(prev => {
        const newSet = new Set(prev);
        newSet.delete(mission.id);
        return newSet;
      });
    }
  };

  const handleReject = async (mission) => {
    const reason = rejectionReasons[mission.id]?.trim();
    if (!reason) {
      setError('Please provide a reason for rejection.');
      return;
    }
    
    if (processingMissions.has(mission.id)) return;
    
    setProcessingMissions(prev => new Set(prev).add(mission.id));
    setError(''); // Clear previous error
    
    try {
      console.log(`Rejecting mission: ${mission.id}`);
      const result = await processMissionRejection({ 
        missionId: mission.id, 
        reason 
      });
      
      if (result.data?.success) {
        console.log('Mission rejected successfully');
        // Remove from pending list
        setMissions(prev => prev.filter(m => m.id !== mission.id));
        // Clear rejection reason
        setRejectionReasons(prev => {
          const updated = { ...prev };
          delete updated[mission.id];
          return updated;
        });
      } else {
        // Assume result.data?.error contains a user-friendly message
        throw new Error(result.data?.error || 'Rejection failed');
      }
    } catch (error) {
      console.error('Error rejecting mission:', error);
      setError(`Failed to reject mission: ${error.message}`);
    } finally {
      setProcessingMissions(prev => {
        const newSet = new Set(prev);
        newSet.delete(mission.id);
        return newSet;
      });
    }
  };

  // Show error state if no campaign ID
  if (!campaignId) {
    return (
      <div className="bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6 text-center">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500" />
              <h2 className="text-lg font-semibold text-red-900 mb-2">No Campaign Selected</h2>
              <p className="text-red-700 mb-4">
                Please select a campaign from your Campaign Manager to review submissions.
              </p>
              <Link to={createPageUrl('CampaignManager')}>
                <Button className="bg-[var(--cashlap-blue)] hover:opacity-90">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Go to Campaign Manager
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 py-16">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-[var(--cashlap-blue)]" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Submissions</h3>
            <p className="text-gray-600">Getting mission submissions ready for review...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error state when the campaign itself failed to load or is not found
  if (error && !campaign) {
    return (
      <div className="bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6 text-center">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500" />
              <h2 className="text-lg font-semibold text-red-900 mb-2">Error Loading Campaign</h2>
              <p className="text-red-700 mb-4">{error}</p>
              <div className="flex gap-2 justify-center">
                <Button onClick={loadSubmissionData} variant="outline" disabled={loading}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Try Again
                </Button>
                <Link to={createPageUrl('CampaignManager')}>
                  <Button className="bg-[var(--cashlap-blue)] hover:opacity-90">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Campaigns
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 p-4 pb-24">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link to={createPageUrl('CampaignManager')}>
              <Button variant="ghost" size="sm" className="mb-1 -ml-2">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            </Link>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">Submission Review</h1>
            {campaign && (
              <p className="text-sm text-gray-600 mt-0.5 break-words">
                <span className="font-medium">{campaign.title}</span>
              </p>
            )}
          </div>
          <Button
            onClick={loadSubmissionData}
            variant="outline"
            size="sm"
            disabled={loading}
            className="flex-shrink-0 mt-1"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Error Banner for general action errors (approve/reject) */}
        {error && campaign && ( // Only show if campaign is loaded but an action caused an error
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-800 font-medium">Error</p>
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setError('')}
                  className="text-red-600 hover:text-red-800"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Campaign Info */}
        {campaign && (
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-gray-900">${campaign.reward_amount}</p>
                  <p className="text-sm text-gray-500">Reward Amount</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{missions.length}</p>
                  <p className="text-sm text-gray-500">Manual Reviews Needed</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{campaign.current_participants || 0}</p>
                  <p className="text-sm text-gray-500">Total Participants</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submissions */}
        <AnimatePresence>
          {missions.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No Pending Reviews
                </h3>
                <p className="text-gray-600">
                  There are currently no mission submissions awaiting your review.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {missions.map((mission) => (
                <motion.div
                  key={mission.id}
                  layout // Enables smooth transitions for layout changes
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }} // Shorter exit for quick removal
                >
                  <Card>
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg break-words">{mission.title}</CardTitle>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 mt-2">
                            <div className="flex items-center gap-1">
                              <UserIcon className="w-4 h-4" />
                              <span>Player: {mission.created_by || mission.user_id}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>
                                {mission.submitted_at ? 
                                  format(new Date(mission.submitted_at), 'MMM d, yyyy h:mm a') : 
                                  'Recently submitted'
                                }
                              </span>
                            </div>
                          </div>
                        </div>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800 flex-shrink-0">
                          <Clock className="w-3 h-3 mr-1" />
                          Pending Review
                        </Badge>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      {/* Mission Details */}
                      {mission.description && (
                        <div>
                          <p className="font-medium text-gray-900 mb-2">Mission Description:</p>
                          <p className="text-gray-600">{mission.description}</p>
                        </div>
                      )}
                      
                      {/* Reward Amount */}
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">Reward:</span>
                        <Badge className="bg-green-100 text-green-800">
                          ${mission.reward_amount}
                        </Badge>
                      </div>

                      {/* Submission Content */}
                      <div className="border-t pt-4">
                        <h4 className="font-medium text-gray-900 mb-3">Player Submission:</h4>
                        
                        {/* Social Media Link */}
                        {mission.submission_url && (
                          <div className="mb-3">
                            <p className="text-sm font-medium text-gray-700 mb-1">Submission Proof (Link):</p>
                            <a
                              href={mission.submission_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm break-all"
                            >
                              <ExternalLink className="w-4 h-4 flex-shrink-0" />
                              <span className="min-w-0">{mission.submission_url}</span>
                            </a>
                          </div>
                        )}
                        
                        {/* Screenshot */}
                        {mission.submission_screenshot_url && (
                          <div className="mb-3">
                            <p className="text-sm font-medium text-gray-700 mb-1">Screenshot:</p>
                            <img
                              src={mission.submission_screenshot_url}
                              alt="Submission screenshot"
                              className="rounded-lg max-h-64 object-contain border border-gray-200"
                            />
                          </div>
                        )}

                        {/* Player Notes */}
                        {mission.submission_notes && (
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-1">Player Notes:</p>
                            <p className="text-gray-600 bg-gray-50 p-3 rounded-lg">
                              {mission.submission_notes}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Review Actions */}
                      <div className="border-t pt-4 space-y-3">
                        <div className="flex flex-col sm:flex-row gap-3">
                          <Button
                            onClick={() => handleApprove(mission)}
                            disabled={processingMissions.has(mission.id)}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                          >
                            {processingMissions.has(mission.id) ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                            )}
                            Approve & Pay
                          </Button>
                          
                          <Button
                            onClick={() => handleReject(mission)}
                            disabled={processingMissions.has(mission.id) || !rejectionReasons[mission.id]?.trim()}
                            variant="destructive"
                            className="flex-1"
                          >
                            {processingMissions.has(mission.id) ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <X className="w-4 h-4 mr-2" />
                            )}
                            Reject
                          </Button>
                        </div>
                        
                        <div>
                          <Textarea
                            placeholder="If rejecting, please provide a reason for the player..."
                            value={rejectionReasons[mission.id] || ''}
                            onChange={(e) => setRejectionReasons(prev => ({
                              ...prev,
                              [mission.id]: e.target.value
                            }))}
                            className="w-full"
                            rows={2}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function SubmissionReview() {
  return (
    <AuthGuard
      requireAuth={true}
      requiredAccountType="business"
      requireBusinessId={true}
      fallbackUrl="Dashboard"
    >
      <SubmissionReviewContent />
    </AuthGuard>
  );
}