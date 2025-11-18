import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Campaign } from '@/entities/all';
import AuthGuard from '@/components/auth/AuthGuard';
import CampaignAnalyticsDetail from '@/components/analytics/CampaignAnalyticsDetail';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';

function CampaignAnalyticsContent() {
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const loadCampaignData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get campaign ID from URL
        const urlParams = new URLSearchParams(location.search);
        const campaignId = urlParams.get('campaignId');

        if (!campaignId) {
          throw new Error('Campaign ID is required');
        }

        // Load campaign data
        const campaigns = await Campaign.filter({ id: campaignId });
        if (campaigns.length === 0) {
          throw new Error('Campaign not found');
        }

        setCampaign(campaigns[0]);

      } catch (err) {
        console.error('Error loading campaign analytics:', err);
        setError(err.message || 'Failed to load campaign data');
      } finally {
        setLoading(false);
      }
    };

    loadCampaignData();
  }, [location]);

  if (loading) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--cashlap-blue)] mb-4" />
        <p className="text-gray-600">Loading campaign analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <Card className="border-red-200">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Analytics</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="space-y-2">
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
    );
  }

  if (!campaign) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Campaign Not Found</h2>
            <p className="text-gray-600 mb-4">The requested campaign could not be found.</p>
            <Link to={createPageUrl('CampaignManager')}>
              <Button className="bg-[var(--cashlap-blue)] hover:opacity-90">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Campaigns
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <div className="p-4 border-b bg-white sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link to={createPageUrl('CampaignManager')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 truncate">{campaign.title}</h1>
            <p className="text-sm text-gray-500">Campaign Analytics</p>
          </div>
        </div>
      </div>

      <CampaignAnalyticsDetail campaign={campaign} />
    </div>
  );
}

export default function CampaignAnalytics() {
  return (
    <AuthGuard
      requireAuth={true}
      requiredAccountType="business"
      requireBusinessId={true}
      fallbackUrl="Dashboard"
    >
      <CampaignAnalyticsContent />
    </AuthGuard>
  );
}