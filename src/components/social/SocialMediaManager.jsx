import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { User } from '@/entities/User';
import { socialMediaAuth, socialMediaSync } from '@/functions/all';
import {
  Instagram,
  Facebook,
  Twitter,
  Video,
  ExternalLink,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Unlink,
  Loader2
} from 'lucide-react';
import { motion } from 'framer-motion';

const socialPlatforms = [
  {
    id: 'instagram',
    name: 'Instagram',
    icon: Instagram,
    color: 'text-pink-500',
    bgColor: 'bg-pink-50',
    description: 'Connect your Instagram account to unlock photo missions'
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: Facebook,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    description: 'Link your Facebook page for business campaigns'
  },
  {
    id: 'twitter',
    name: 'Twitter',
    icon: Twitter,
    color: 'text-blue-400',
    bgColor: 'bg-blue-50',
    description: 'Share your experiences and earn rewards'
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: Video,
    color: 'text-black',
    bgColor: 'bg-gray-50',
    description: 'Create viral content for brand campaigns'
  }
];

export default function SocialMediaManager({ user, onUpdate }) {
  const [loading, setLoading] = useState({});
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [syncingAll, setSyncingAll] = useState(false);

  const handleConnect = async (platform) => {
    setLoading(prev => ({ ...prev, [platform]: true }));
    setError(null);
    
    try {
      // Get OAuth URL
      const { data: authData } = await socialMediaAuth({
        platform,
        action: 'getAuthUrl'
      });
      
      // Open OAuth window
      const width = 600;
      const height = 700;
      const left = (window.innerWidth / 2) - (width / 2);
      const top = (window.innerHeight / 2) - (height / 2);
      
      const authWindow = window.open(
        authData.authUrl,
        `${platform}_auth`,
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
      );
      
      // Listen for OAuth completion
      const pollTimer = setInterval(() => {
        try {
          if (authWindow.closed) {
            clearInterval(pollTimer);
            setLoading(prev => ({ ...prev, [platform]: false }));
            // Check if connection was successful
            checkConnectionStatus(platform);
          }
        } catch (e) {
          // Cross-origin error when checking authWindow.location
          // This likely means the OAuth flow is in progress
        }
      }, 1000);
      
    } catch (error) {
      console.error(`Error connecting ${platform}:`, error);
      setError(`Failed to connect ${platform}. Please try again.`);
      setLoading(prev => ({ ...prev, [platform]: false }));
    }
  };

  const handleDisconnect = async (platform) => {
    if (!confirm(`Are you sure you want to disconnect ${platform}?`)) {
      return;
    }
    
    setLoading(prev => ({ ...prev, [platform]: true }));
    
    try {
      await socialMediaAuth({
        platform,
        action: 'disconnect'
      });
      
      setSuccess(`${platform} disconnected successfully`);
      onUpdate?.();
      
    } catch (error) {
      console.error(`Error disconnecting ${platform}:`, error);
      setError(`Failed to disconnect ${platform}. Please try again.`);
    } finally {
      setLoading(prev => ({ ...prev, [platform]: false }));
    }
  };

  const handleSync = async (platform) => {
    setLoading(prev => ({ ...prev, [platform]: true }));
    
    try {
      const { data } = await socialMediaSync({
        action: 'syncProfile',
        platform
      });
      
      setSuccess(`${platform} profile synced successfully`);
      onUpdate?.();
      
    } catch (error) {
      console.error(`Error syncing ${platform}:`, error);
      setError(`Failed to sync ${platform} profile. Please try again.`);
    } finally {
      setLoading(prev => ({ ...prev, [platform]: false }));
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    
    try {
      await socialMediaSync({
        action: 'syncAllPlatforms'
      });
      
      setSuccess('All connected platforms synced successfully');
      onUpdate?.();
      
    } catch (error) {
      console.error('Error syncing all platforms:', error);
      setError('Failed to sync some platforms. Please try individual sync.');
    } finally {
      setSyncingAll(false);
    }
  };

  const checkConnectionStatus = async (platform) => {
    // Refresh user data to check connection status
    try {
      const updatedUser = await User.me();
      if (updatedUser[`${platform}_connected`]) {
        setSuccess(`${platform} connected successfully!`);
        onUpdate?.();
      }
    } catch (error) {
      console.error('Error checking connection status:', error);
    }
  };

  const isConnected = (platform) => {
    return user?.[`${platform}_connected`] || false;
  };

  const getFollowerCount = (platform) => {
    return user?.[`${platform}_follower_count`] || 0;
  };

  const getLastSynced = (platform) => {
    const lastSynced = user?.[`${platform}_last_synced`];
    if (!lastSynced) return null;
    
    const date = new Date(lastSynced);
    return date.toLocaleDateString();
  };

  useEffect(() => {
    // Clear success/error messages after 5 seconds
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Social Media Accounts</h3>
          <p className="text-sm text-gray-600">Connect your accounts to unlock more opportunities</p>
        </div>
        <Button
          onClick={handleSyncAll}
          disabled={syncingAll}
          variant="outline"
          size="sm"
        >
          {syncingAll ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Sync All
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">{success}</AlertDescription>
        </Alert>
      )}

      {/* Platform Cards */}
      <div className="grid gap-4">
        {socialPlatforms.map((platform) => {
          const Icon = platform.icon;
          const connected = isConnected(platform.id);
          const followerCount = getFollowerCount(platform.id);
          const lastSynced = getLastSynced(platform.id);
          const isLoading = loading[platform.id];

          return (
            <motion.div
              key={platform.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-lg ${platform.bgColor} flex items-center justify-center`}>
                        <Icon className={`w-6 h-6 ${platform.color}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{platform.name}</h4>
                          {connected && (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Connected
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{platform.description}</p>
                        {connected && (
                          <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                            <span>{followerCount.toLocaleString()} followers</span>
                            {lastSynced && <span>Last synced: {lastSynced}</span>}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {connected ? (
                        <>
                          <Button
                            onClick={() => handleSync(platform.id)}
                            disabled={isLoading}
                            variant="outline"
                            size="sm"
                          >
                            {isLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            onClick={() => handleDisconnect(platform.id)}
                            disabled={isLoading}
                            variant="outline"
                            size="sm"
                          >
                            <Unlink className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          onClick={() => handleConnect(platform.id)}
                          disabled={isLoading}
                          className="bg-[var(--cashlap-green)] hover:opacity-90"
                          size="sm"
                        >
                          {isLoading ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <ExternalLink className="w-4 h-4 mr-2" />
                          )}
                          Connect
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Influencer Rank Display */}
      {user?.total_followers > 0 && (
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="p-4">
            <div className="text-center">
              <h4 className="font-semibold text-purple-800">Your Influencer Status</h4>
              <div className="flex items-center justify-center gap-4 mt-2">
                <Badge className="bg-purple-100 text-purple-800 px-3 py-1">
                  {user.influencer_rank}
                </Badge>
                <span className="text-sm text-gray-600">
                  {user.total_followers?.toLocaleString()} total followers
                </span>
                <Badge variant="outline" className="text-green-700">
                  {user.total_followers >= 100000 ? '5x' : 
                   user.total_followers >= 50000 ? '3x' : 
                   user.total_followers >= 5000 ? '2x' : 
                   user.total_followers >= 1000 ? '1.5x' : '1x'} earnings
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}