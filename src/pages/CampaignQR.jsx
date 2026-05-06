import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Campaign, User } from '@/entities/all';
import QRCodeGenerator from '@/components/qr/QRCodeGenerator';
import AuthGuard from '@/components/auth/AuthGuard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, ArrowLeft, QrCode } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';

function CampaignQRContent() {
    const [campaign, setCampaign] = useState(null);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    const location = useLocation();

    useEffect(() => {
        const fetchCampaignData = async () => {
            setLoading(true);
            setError('');
            try {
                const params = new URLSearchParams(location.search);
                const campaignId = params.get('campaignId') || params.get('campaignid');

                if (!campaignId) {
                    setError("No campaign specified.");
                    setLoading(false);
                    return;
                }

                const [currentUser, campaignData] = await Promise.all([
                    User.me(),
                    Campaign.get(campaignId)
                ]);

                setUser(currentUser);

                if (!campaignData) {
                    setError("Campaign not found. It may have been deleted.");
                    setLoading(false);
                    return;
                }

                // Security Check: Ensure the current user owns this campaign
                if (campaignData.business_id !== currentUser.business_id) {
                    setError("You do not have permission to view this campaign's QR codes.");
                    setCampaign(null);
                } else {
                    setCampaign(campaignData);
                }

            } catch (err) {
                console.error("Error fetching campaign data for QR page:", err);
                setError("Failed to load campaign data. Please check your connection and try again.");
            } finally {
                setLoading(false);
            }
        };

        fetchCampaignData();
    }, [location.search]);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center p-4">
                <div className="text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-[var(--cashlap-blue)]" />
                    <p className="text-gray-600">Loading Campaign QR Codes...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-full flex items-center justify-center p-4">
                <Card className="w-full max-w-md border-red-200 bg-red-50">
                    <CardContent className="p-6 text-center">
                        <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500" />
                        <h3 className="text-lg font-semibold mb-2">An Error Occurred</h3>
                        <p className="text-sm text-red-800 mb-4">{error}</p>
                        <Link to={createPageUrl("CampaignManager")}>
                            <Button variant="destructive">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back to Campaign Manager
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!campaign) {
        return (
             <div className="h-full flex items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardContent className="p-6 text-center">
                        <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                        <h3 className="text-lg font-semibold mb-2">Campaign Not Found</h3>
                        <p className="text-sm text-gray-600 mb-4">The requested campaign could not be loaded.</p>
                        <Link to={createPageUrl("CampaignManager")}>
                            <Button variant="outline">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back to Campaign Manager
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 space-y-6 pb-24">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                <Link to={createPageUrl("CampaignManager")}>
                    <Button variant="outline" size="sm" className="mb-4">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Campaigns
                    </Button>
                </Link>
                <Card className="overflow-hidden">
                    <div className="bg-gray-900 text-white p-6">
                         <div className="flex items-start justify-between">
                            <div>
                                <h1 className="text-2xl font-bold">{campaign.title}</h1>
                                <p className="text-gray-300 mt-1">QR Code Management</p>
                            </div>
                            <QrCode className="w-10 h-10 text-gray-500"/>
                        </div>
                    </div>
                    <CardContent className="p-0">
                        <QRCodeGenerator campaign={campaign} user={user} />
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}

export default function CampaignQR() {
    return (
        <AuthGuard
            requireAuth={true}
            requiredAccountType="business"
            requireBusinessId={true}
            fallbackUrl="Dashboard"
        >
            <CampaignQRContent />
        </AuthGuard>
    );
}