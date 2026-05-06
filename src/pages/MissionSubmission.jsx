import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Mission, Campaign } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Share,
  ExternalLink,
  CheckCircle,
  Instagram,
  Music,
} from "lucide-react";
import { submitMissionProof } from "@/functions/submitMissionProof";
import SuccessModal from "@/components/mission/SuccessModal";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import AuthGuard from "@/components/auth/AuthGuard";

function MissionSubmissionContent() {
  // Core data states
  const [mission, setMission] = useState(null);
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Submission states
  const [submissionUrl, setSubmissionUrl] = useState("");
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState(null);

  // Get mission ID from URL (handle both camelCase and lowercase variants)
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const missionId = params.get('missionId') || params.get('missionid');

  // Load mission data once on mount
  useEffect(() => {
    if (!missionId) {
      setError("Mission ID is required");
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        const missionData = await Mission.get(missionId);
        if (!missionData) throw new Error("Mission not found");
        
        setMission(missionData);
        
        if (missionData.campaign_id) {
          const campaignData = await Campaign.get(missionData.campaign_id);
          setCampaign(campaignData);
        }
      } catch (err) {
        console.error("Error loading mission:", err);
        setError("Failed to load mission details.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [missionId]);

  // Handle submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!submissionUrl.trim()) {
      setError("Please provide the link to your social media post.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await submitMissionProof({
        missionId: mission.id,
        submissionUrl: submissionUrl.trim(),
        submissionNotes: submissionNotes.trim()
      });

      if (response.data.success) {
        setSuccessData({
          approved: response.data.auto_approved || false,
          message: response.data.message || 'Your submission is now pending review. The business will approve your post, and you\'ll receive your reward once it\'s confirmed!',
          mission: response.data.mission || mission
        });
        setShowSuccessModal(true);
      } else {
        throw new Error(response.data.error || 'Submission failed');
      }
    } catch (error) {
      console.error('Submission error:', error);
      
      if (error.response?.data?.needs_profile_update) {
        setError(`⚠️ Profile Update Required: ${error.response.data.error}`);
      } else {
        setError(error.response?.data?.error || error.message || 'Failed to submit proof. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Open social media platforms
  const openTikTok = () => {
    window.open('https://www.tiktok.com/upload', '_blank');
  };

  const openInstagram = () => {
    window.open('https://www.instagram.com/', '_blank');
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white text-gray-900">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[var(--cashlap-green)] mx-auto mb-4" />
          <p>Loading Mission...</p>
        </div>
      </div>
    );
  }

  if (error && !mission) {
    return (
      <div className="h-screen flex items-center justify-center bg-white text-gray-900 p-4">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Error</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <Link to={createPageUrl("Dashboard")}>
            <Button className="bg-red-500 hover:bg-red-600">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Return to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900" style={{ overflow: 'auto', height: '100vh' }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center gap-3">
          <Link to={createPageUrl("Dashboard")}>
            <Button variant="ghost" size="icon" className="text-gray-700 hover:text-gray-900 hover:bg-gray-100">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-bold text-lg text-gray-900">{mission?.title}</h1>
            <p className="text-sm text-gray-600">{campaign?.title}</p>
          </div>
        </div>
      </div>

      {/* Scrollable Main Content */}
      <div className="overflow-y-auto h-full" style={{ paddingBottom: '120px' }}>
        <div className="p-4 space-y-6">
          {/* Mission Details */}
          <div className="bg-gradient-to-r from-[var(--cashlap-green)] to-[var(--cashlap-blue)] text-white p-6 rounded-xl">
            <h2 className="text-xl font-bold mb-2">{campaign?.title}</h2>
            <p className="text-blue-100 mb-4">{campaign?.description}</p>
            <div className="flex items-center gap-4">
              <div className="bg-white/20 px-3 py-1 rounded-full">
                <span className="font-semibold">${mission?.reward_amount}</span>
              </div>
              <div className="text-sm text-blue-100">
                Reward Amount
              </div>
            </div>
          </div>

          {/* Requirements */}
          {campaign?.requirements && campaign.requirements.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
              <h3 className="font-semibold text-blue-900 mb-2">Mission Requirements</h3>
              <ul className="space-y-1">
                {campaign.requirements.map((req, index) => (
                  <li key={index} className="flex items-start gap-2 text-blue-800">
                    <CheckCircle className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
                    <span className="text-sm">{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Step 1: Create Content */}
          <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm">
            <h3 className="font-semibold text-xl mb-2 text-gray-900">Step 1: Create Your Content</h3>
            <p className="text-gray-600 mb-4">
              Create and post your content on TikTok or Instagram following all mission requirements.
            </p>
            
            <div className="space-y-3">
              <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3">
                <Button 
                  onClick={openTikTok}
                  className="bg-black hover:bg-gray-800 text-white h-12 w-full flex items-center justify-center gap-2"
                >
                  <Music className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm font-medium">TikTok</span>
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </Button>
                
                <Button 
                  onClick={openInstagram}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white h-12 w-full flex items-center justify-center gap-2"
                >
                  <Instagram className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm font-medium">Instagram</span>
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </Button>
              </div>
            </div>
          </div>

          {/* Step 2: Submit Link */}
          <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm">
            <h3 className="font-semibold text-xl mb-4 text-gray-900">Step 2: Submit Your Post</h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-sm leading-relaxed">{error}</p>
                  {error.includes('Profile Update Required') && (
                    <button 
                      type="button"
                      onClick={() => window.location.href = createPageUrl('Profile')}
                      className="mt-2 text-red-600 underline text-sm hover:text-red-800"
                    >
                      Update Profile Now →
                    </button>
                  )}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Post URL <span className="text-red-500">*</span>
                </label>
                <Input
                  type="url"
                  value={submissionUrl}
                  onChange={(e) => setSubmissionUrl(e.target.value)}
                  placeholder="https://www.tiktok.com/@username/video/... or https://www.instagram.com/p/..."
                  required
                  className="bg-white border-gray-300 text-gray-900 focus:border-[var(--cashlap-green)] focus:ring-[var(--cashlap-green)]"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes (Optional)
                </label>
                <Textarea
                  value={submissionNotes}
                  onChange={(e) => setSubmissionNotes(e.target.value)}
                  placeholder="Any additional details about your submission..."
                  rows={3}
                  className="bg-white border-gray-300 text-gray-900 focus:border-[var(--cashlap-green)] focus:ring-[var(--cashlap-green)]"
                />
              </div>
              
              <Button 
                type="submit" 
                disabled={submitting || !submissionUrl} 
                className="w-full bg-[var(--cashlap-green)] hover:bg-[var(--cashlap-green)]/90 text-white h-12 text-base font-semibold flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Share className="w-5 h-5 flex-shrink-0" />
                    <span>Submit for Review</span>
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* Help Section */}
          <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
            <h4 className="font-medium text-gray-900 mb-2">Need Help?</h4>
            <p className="text-sm text-gray-600">
              Make sure your post includes all required elements and follows the campaign guidelines. 
              Your submission will be reviewed by the business owner, and you'll receive your reward once approved.
            </p>
          </div>

          {/* Extra spacing at bottom for safe scrolling */}
          <div className="h-20"></div>
        </div>
      </div>

      {showSuccessModal && successData && (
        <SuccessModal
          success={successData}
          onClose={() => {
            setShowSuccessModal(false);
            window.location.href = createPageUrl("Dashboard");
          }}
        />
      )}
    </div>
  );
}

export default function MissionSubmission() {
  return (
    <AuthGuard requireAuth={true} requiredAccountType="player" fallbackUrl="Dashboard">
      <MissionSubmissionContent />
    </AuthGuard>
  );
}