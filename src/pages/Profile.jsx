
import { useState, useEffect } from "react";
import { User, Mission, Business } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createPageUrl } from "@/utils";
import {
  User as UserIcon,
  Edit,
  Save,
  X,
  Star,
  Trophy,
  Target,
  TrendingUp,
  RefreshCw,
  Settings,
  Repeat,
  Shield,
  Loader2,
  Database,
  AlertTriangle // Added for the new admin button
} from "lucide-react";
import { motion } from "framer-motion";
import ReferralCard from "@/components/profile/ReferralCard";
import InfluencerRankCard from "@/components/influencer/InfluencerRankCard";
import { Link } from "react-router-dom";
import { sanitizeObject } from "@/components/utils/sanitizer";
import { clearAllPlayerBalances } from "@/functions/clearAllPlayerBalances";
import { debugBusinessBalance } from "@/functions/debugBusinessBalance";
import { deleteAllCampaigns } from "@/functions/deleteAllCampaigns"; // New import
import AuthGuard from "@/components/auth/AuthGuard";

function ProfileContent() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const [formData, setFormData] = useState({});
  const [missions, setMissions] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [isClearing, setIsClearing] = useState(false);
  const [clearMessage, setClearMessage] = useState('');
  const [isDebugging, setIsDebugging] = useState(false);
  const [debugMessage, setDebugMessage] = useState('');
  const [isDeletingAllCampaigns, setIsDeletingAllCampaigns] = useState(false); // New state
  const [deleteAllCampaignsMessage, setDeleteAllCampaignsMessage] = useState(''); // New state

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      setFormData({
        display_name: currentUser.display_name || currentUser.full_name || '',
        bio: currentUser.bio || '',
        tiktok_handle: currentUser.social_handles?.tiktok || '',
        instagram_handle: currentUser.social_handles?.instagram || ''
      });

      if (currentUser.account_type === 'player') {
        const userMissions = await Mission.filter({ user_id: currentUser.id });
        setMissions(userMissions);

        const businessList = await Business.list();
        setBusinesses(businessList);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const dataToUpdate = sanitizeObject({
        display_name: formData.display_name,
        bio: formData.bio,
        social_handles: {
          ...(user.social_handles || {}),
          tiktok: formData.tiktok_handle,
          instagram: formData.instagram_handle
        }
      });
      await User.updateMyUserData(dataToUpdate);

      localStorage.removeItem('cached_user_data');

      alert("Profile updated successfully!");

      window.location.reload();
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile. Please try again.");
    }
  };

  const handleCancel = () => {
    setFormData({
      display_name: user.display_name || user.full_name || '',
      bio: user.bio || '',
      tiktok_handle: user.social_handles?.tiktok || '',
      instagram_handle: user.social_handles?.instagram || ''
    });
  };

  const handleRestartOnboarding = async () => {
    if (window.confirm("Are you sure you want to restart the setup process? This will take you back to the onboarding screen to re-select your account type and preferences.")) {
      try {
        await User.updateMyUserData({ onboarding_completed: false });
        window.location.href = createPageUrl('Onboarding');
      } catch (error) {
        console.error("Error restarting onboarding:", error);
        alert("Failed to restart onboarding. Please try again.");
      }
    }
  };

  const handleSwitchAccountType = async () => {
    const newAccountType = user.account_type === 'player' ? 'business' : 'player';
    if (window.confirm(`Are you sure you want to switch to your ${newAccountType} account? Your dashboard will reload to apply the changes.`)) {
      setIsSwitching(true);
      try {
        const updateData = {
          account_type: newAccountType,
        };

        // If switching to a business account, ensure we have the required business entity
        if (newAccountType === 'business') {
          // Check if Business entity already exists
          let existingBusiness = null;
          if (user.business_id) {
            try {
              const businessRecords = await Business.filter({ id: user.business_id });
              if (businessRecords.length > 0) {
                existingBusiness = businessRecords[0];
              }
            } catch (error) {
              console.warn('Could not check existing business:', error);
            }
          }

          // Create Business entity if it doesn't exist
          if (!existingBusiness) {
            try {
              const newBusiness = await Business.create({
                business_owner_id: user.id,
                name: user.business_name || `${user.full_name?.split(' ')[0] || 'My'} Business`,
                description: user.business_description || 'Business description to be updated',
                address: user.business_address || 'Address to be updated',
                category: 'services', // Default category
              });
              
              updateData.business_id = newBusiness.id;
              console.log('Created new Business entity:', newBusiness.id);
            } catch (businessError) {
              console.error('Failed to create Business entity:', businessError);
              alert('Failed to create business profile. Please try again or contact support.');
              setIsSwitching(false);
              return;
            }
          } else {
            updateData.business_id = existingBusiness.id;
          }

          // Set other business defaults on the User object if not already set
          if (!user.business_name) {
            updateData.business_name = `${user.full_name?.split(' ')[0] || 'My'} Business`;
          }
          if (!user.business_address) {
            updateData.business_address = 'Address to be updated';
          }
          // Only set default if average_daily_traffic is not defined or is null
          if (typeof user.average_daily_traffic === 'undefined' || user.average_daily_traffic === null) {
            updateData.average_daily_traffic = 0;
          }
        }
        
        // Update user data on the server
        await User.updateMyUserData(updateData);

        // Clear any cached user data from the browser to ensure a fresh start
        localStorage.removeItem('cached_account_type');
        localStorage.removeItem('cached_user_data');

        // Reload the application to the dashboard to reflect the new account type
        alert(`Switched to ${newAccountType} account. The app will now reload.`);
        window.location.href = createPageUrl('Dashboard');

      } catch (error) {
        console.error("Error switching account type:", error.response?.data || error);
        alert("Failed to switch account type. Please try again or contact support.");
      } finally {
        setIsSwitching(false);
      }
    }
  };

  const handleClearBalances = async () => {
    if (window.confirm("DANGER: This will reset ALL player earnings balances to $0.00. This action cannot be undone. Are you sure you want to proceed?")) {
        setIsClearing(true);
        setClearMessage('');
        try {
            const { data } = await clearAllPlayerBalances();
            if (data.success) {
                setClearMessage(data.message);
                alert('Success: ' + data.message);
                loadData(); 
            } else {
                throw new Error(data.error || 'Failed to clear balances.');
            }
        } catch (error) {
            const errorMessage = error.response?.data?.error || error.message || 'An unknown error occurred.';
            setClearMessage(`Error: ${errorMessage}`);
            alert(`Error: ${errorMessage}`);
        } finally {
            setIsClearing(false);
        }
    }
  };

  const handleDebugBusinessBalance = async () => {
    if (!user) return;
    
    setIsDebugging(true);
    setDebugMessage('');
    
    try {
      const { data } = await debugBusinessBalance({ 
        user_id: user.id, 
        amount_to_add: 50 
      });
      
      if (data.success) {
        setDebugMessage(`Success: ${data.message}. Old: $${data.old_balance}, New: $${data.new_balance}`);
        alert('Debug successful! Check console for details. Refreshing page...');
        setTimeout(() => window.location.reload(), 1000);
      } else {
        throw new Error(data.error || 'Debug failed');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Debug function failed';
      setDebugMessage(`Error: ${errorMessage}`);
      alert(`Debug Error: ${errorMessage}`);
    } finally {
      setIsDebugging(false);
    }
  };

  const handleDeleteAllCampaigns = async () => {
    const confirmMessage = "⚠️ DANGER: This will permanently delete ALL campaigns and related data from the entire CashLap platform.\n\n" +
                          "This includes:\n" +
                          "• All campaigns from all businesses\n" +
                          "• All missions and submissions\n" +
                          "• All QR codes\n" +
                          "• All check-ins\n" +
                          "• Related notifications\n\n" +
                          "THIS ACTION CANNOT BE UNDONE.\n\n" +
                          "Are you absolutely sure you want to proceed?";

    if (!window.confirm(confirmMessage)) {
      return;
    }

    // Double confirmation for such a destructive action
    const finalConfirm = window.prompt(
      "To confirm this action, please type 'DELETE ALL CAMPAIGNS' exactly:"
    );

    if (finalConfirm !== 'DELETE ALL CAMPAIGNS') {
      alert('Action cancelled. The text did not match exactly.');
      return;
    }

    setIsDeletingAllCampaigns(true);
    setDeleteAllCampaignsMessage('');

    try {
      const { data } = await deleteAllCampaigns();
      
      if (data.success) {
        const summary = `✅ Successfully deleted:\n` +
                       `• ${data.campaigns_deleted} campaigns\n` +
                       `• ${data.missions_deleted} missions\n` +
                       `• ${data.qr_codes_deleted} QR codes\n` +
                       `• ${data.check_ins_deleted} check-ins\n` +
                       `• ${data.notifications_deleted} notifications\n` +
                       `\nTotal records deleted: ${data.total_records_deleted}`;
        
        setDeleteAllCampaignsMessage(data.message);
        alert(summary);
      } else {
        throw new Error(data.error || 'Failed to delete campaigns.');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'An unknown error occurred.';
      setDeleteAllCampaignsMessage(`Error: ${errorMessage}`);
      alert(`Error: ${errorMessage}`);
    } finally {
      setIsDeletingAllCampaigns(false);
    }
  };

  const getPlayerStats = () => {
    const completedMissions = missions.filter(m => m.status === 'approved');
    const totalEarnings = completedMissions.reduce((sum, m) => sum + (m.reward_amount || 0), 0);

    return {
      totalMissions: missions.length,
      completedMissions: completedMissions.length,
      totalEarnings,
      level: user?.level || 1,
      experiencePoints: user?.experience_points || 0
    };
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-32 bg-gray-200 rounded-2xl animate-pulse" />
        <div className="h-40 bg-gray-200 rounded-xl animate-pulse" />
        <div className="h-32 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4">
        <Card className="text-center p-8">
          <UserIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold mb-2">Profile Not Found</h3>
          <p className="text-gray-500">Unable to load your profile. Please try again.</p>
        </Card>
      </div>
    );
  }

  const stats = user.account_type === 'player' ? getPlayerStats() : null;

  return (
    <div className="p-4 space-y-6 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-[var(--cashlap-green)] to-[var(--cashlap-blue)] rounded-2xl p-4 sm:p-6 text-white border border-gray-200"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 rounded-full flex items-center justify-center border-2 border-white/30">
              {user.profile_image_url ? (
                <img src={user.profile_image_url} alt="Profile" className="w-full h-full rounded-full object-cover" />
              ) : (
                <UserIcon className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              )}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">{user.display_name || user.full_name || 'User'}</h1>
              <p className="text-blue-100 text-sm sm:text-base">{user.email}</p>
            </div>
          </div>
        </div>
      </motion.div>

      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl text-gray-900">
            <Edit className="w-5 h-5 text-gray-700" />
            Edit Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm sm:text-base font-medium mb-2 text-gray-800">Display Name</label>
            <Input
              value={formData.display_name}
              onChange={(e) => setFormData({...formData, display_name: e.target.value})}
              placeholder="Enter your display name"
              className="text-base border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm sm:text-base font-medium mb-2 text-gray-800">Bio</label>
            <Textarea
              value={formData.bio}
              onChange={(e) => setFormData({...formData, bio: e.target.value})}
              placeholder="Tell us about yourself..."
              rows={3}
              className="text-base border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm sm:text-base font-medium mb-2 text-gray-800">TikTok Handle</label>
            <Input
              value={formData.tiktok_handle}
              onChange={(e) => setFormData({...formData, tiktok_handle: e.target.value})}
              placeholder="@yourhandle"
              className="text-base border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm sm:text-base font-medium mb-2 text-gray-800">Instagram Handle</label>
            <Input
              value={formData.instagram_handle}
              onChange={(e) => setFormData({...formData, instagram_handle: e.target.value})}
              placeholder="@yourhandle"
              className="text-base border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>


          <div className="flex gap-2 pt-4 border-t border-gray-200">
            <Button onClick={handleSave} className="flex-1 bg-[var(--cashlap-green)] hover:opacity-90 text-white text-base" style={{ minHeight: '48px' }}>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
            <Button variant="outline" onClick={handleCancel} className="flex-1 text-base border-gray-300 text-gray-800 hover:bg-gray-100" style={{ minHeight: '48px' }}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>

      {user.account_type === 'player' && (
        <>
          <InfluencerRankCard user={user} onUpdate={loadData} />

          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="border border-gray-200">
                <CardContent className="p-3 sm:p-4 text-center">
                  <Target className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-2 text-[var(--cashlap-orange)]" />
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.completedMissions}</p>
                  <p className="text-xs sm:text-sm text-gray-700">Completed</p>
                </CardContent>
              </Card>

              <Card className="border border-gray-200">
                <CardContent className="p-3 sm:p-4 text-center">
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-2 text-[var(--cashlap-green)]" />
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">${stats.totalEarnings}</p>
                  <p className="text-xs sm:text-sm text-gray-700">Earned</p>
                </CardContent>
              </Card>

              <Card className="border border-gray-200">
                <CardContent className="p-3 sm:p-4 text-center">
                  <Trophy className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-2 text-[var(--cashlap-yellow)]" />
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.level}</p>
                  <p className="text-xs sm:text-sm text-gray-700">Level</p>
                </CardContent>
              </Card>

              <Card className="border border-gray-200">
                <CardContent className="p-3 sm:p-4 text-center">
                  <Star className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-2 text-[var(--cashlap-pink)]" />
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.experiencePoints}</p>
                  <p className="text-xs sm:text-sm text-gray-700">XP</p>
                </CardContent>
              </Card>
            </div>
          )}

          <ReferralCard user={user} />
        </>
      )}

      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl text-gray-900">
            <Settings className="w-5 h-5 text-gray-700" />
            Account Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
            <div>
              <p className="text-sm sm:text-base font-medium text-gray-900">Switch Account Type</p>
              <p className="text-sm sm:text-base text-gray-700 mt-1">
                You are currently using your <span className="font-semibold capitalize text-gray-900">{user.account_type}</span> account.
              </p>
              <Button 
                variant="outline" 
                onClick={handleSwitchAccountType} 
                className="w-full mt-3 text-base border-gray-300 text-gray-800 hover:bg-gray-100" 
                style={{ minHeight: '48px' }}
                disabled={isSwitching}
              >
                {isSwitching ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Repeat className="w-4 h-4 mr-2" />
                )}
                {isSwitching ? 'Switching...' : `Switch to ${user.account_type === 'player' ? 'Business' : 'Player'} Account`}
              </Button>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <p className="text-sm sm:text-base font-medium text-gray-900">Restart Setup Process</p>
              <p className="text-sm sm:text-base text-gray-700 mt-1">
                Need to re-configure your initial settings?
              </p>
              <Button variant="destructive" onClick={handleRestartOnboarding} className="w-full mt-3 text-base bg-red-600 hover:bg-red-700 text-white" style={{ minHeight: '48px' }}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Restart Setup Process
              </Button>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <p className="text-sm sm:text-base font-medium text-gray-900">Security & Privacy</p>
              <p className="text-sm sm:text-base text-gray-700 mt-1">
                Learn how we protect your data.
              </p>
              <Link to={createPageUrl("Security")}>
                <Button variant="outline" className="w-full mt-3 text-base border-gray-300 text-gray-800 hover:bg-gray-100" style={{ minHeight: '48px' }}>
                  <Shield className="w-4 h-4 mr-2" />
                  View Security Details
                </Button>
              </Link>
            </div>
            
            {user.role === 'admin' && (
              <div className="border-t border-red-200 pt-6">
                <p className="text-sm sm:text-base font-medium text-red-700">Admin Actions</p>
                <p className="text-sm text-gray-700 mt-1">
                  Administrative functions for testing and debugging.
                </p>
                
                <div className="space-y-3 mt-3">
                  <Button 
                    variant="destructive" 
                    onClick={handleClearBalances} 
                    className="w-full text-base" 
                    disabled={isClearing}
                    style={{ minHeight: '48px' }}
                  >
                    {isClearing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Database className="w-4 h-4 mr-2" />
                    )}
                    {isClearing ? 'Resetting Balances...' : 'Reset All Player Balances'}
                  </Button>

                  <Button 
                    variant="destructive" 
                    onClick={handleDeleteAllCampaigns} 
                    className="w-full text-base bg-red-700 hover:bg-red-800" 
                    disabled={isDeletingAllCampaigns}
                    style={{ minHeight: '48px' }}
                  >
                    {isDeletingAllCampaigns ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 mr-2" />
                    )}
                    {isDeletingAllCampaigns ? 'Deleting All Campaigns...' : 'Delete All Campaigns'}
                  </Button>
                  
                  {user.account_type === 'business' && (
                    <Button 
                      variant="outline" 
                      onClick={handleDebugBusinessBalance} 
                      className="w-full text-base border-blue-300 text-blue-700 hover:bg-blue-50" 
                      disabled={isDebugging}
                      style={{ minHeight: '48px' }}
                    >
                      {isDebugging ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Database className="w-4 h-4 mr-2" />
                      )}
                      {isDebugging ? 'Adding $50...' : 'Debug: Add $50 to Business Balance'}
                    </Button>
                  )}
                </div>
                
                {clearMessage && (
                  <p className={`text-sm mt-2 text-center ${clearMessage.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>{clearMessage}</p>
                )}
                {debugMessage && (
                  <p className={`text-sm mt-2 text-center ${debugMessage.startsWith('Error') ? 'text-red-600' : 'text-blue-600'}`}>{debugMessage}</p>
                )}
                {deleteAllCampaignsMessage && (
                  <p className={`text-sm mt-2 text-center ${deleteAllCampaignsMessage.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>{deleteAllCampaignsMessage}</p>
                )}
              </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Profile() {
  return (
    <AuthGuard 
      requireAuth={true} 
      fallbackUrl="Onboarding"
    >
      <ProfileContent />
    </AuthGuard>
  );
}
