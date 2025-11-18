
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { syncAndRankInfluencer } from '@/functions/syncAndRankInfluencer';
import { startTikTokOAuth } from '@/functions/startTikTokOAuth';
import { unlinkTikTokAccount } from '@/functions/unlinkTikTokAccount';
import { Instagram, Music, Crown, Loader2, RefreshCw, Link as LinkIcon, CheckCircle, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

const INFLUENCER_TIERS = {
  rookie: { name: 'Rookie', subtitle: 'Nano', emoji: '🐣', description: 'Just starting their rise to fame.', minFollowers: 0, maxFollowers: 9999, multiplier: 1.0, color: '#94A3B8' },
  trendsetter: { name: 'Trendsetter', subtitle: 'Micro', emoji: '🔥', description: 'Sparking buzz and gaining attention.', minFollowers: 10000, maxFollowers: 99999, multiplier: 1.25, color: '#F97316' },
  vibe_curator: { name: 'Vibe Curator', subtitle: 'Mid-Tier', emoji: '🎶', description: 'Setting trends and building a loyal following.', minFollowers: 100000, maxFollowers: 999999, multiplier: 1.5, color: '#8B5CF6' },
  icon: { name: 'Icon', subtitle: 'Macro', emoji: '🌟', description: 'Recognized everywhere, leading the scene.', minFollowers: 1000000, maxFollowers: 9999999, multiplier: 2.0, color: '#EAB308' },
  legend: { name: 'Legend', subtitle: 'Mega', emoji: '👑', description: 'Elite status, cultural influencer, unstoppable.', minFollowers: 10000000, maxFollowers: Infinity, multiplier: 3.0, color: '#DC2626' }
};

export default function InfluencerRankCard({ user, onUpdate }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);

  const handleSync = useCallback(async (isAutoSync = false) => {
    setIsSyncing(true);
    try {
      console.log('[InfluencerRankCard] Starting sync...');
      const response = await syncAndRankInfluencer();
      console.log('[InfluencerRankCard] Sync response:', response.data);
      
      if (response.data?.success) {
        if (onUpdate) {
          console.log('[InfluencerRankCard] Calling onUpdate...');
          onUpdate();
        }
        if (!isAutoSync) {
          alert(`Successfully synced! TikTok: ${response.data.tiktok_followers}, Total: ${response.data.total_followers}`);
        }
      } else {
        throw new Error(response.data?.error || 'Failed to sync');
      }
    } catch (error) {
      console.error('Error syncing followers:', error);
      alert('Failed to sync social media data. Please check your connection and try again.');
    } finally {
      setIsSyncing(false);
    }
  }, [onUpdate]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('tiktok_success')) {
      console.log('TikTok linked successfully! Auto-syncing follower count...');
      window.history.replaceState({}, document.title, window.location.pathname);
      handleSync(true);
    }
  }, [handleSync]);

  const currentRank = user.influencer_rank || 'rookie';
  const rankData = INFLUENCER_TIERS[currentRank];
  const totalFollowers = user.total_followers || 0;
  const hasTikTokToken = Boolean(user.tiktok_access_token);
  
  // Debug logging to help track follower count issues
  console.log('[InfluencerRankCard] User data:', {
    tiktok_followers: user.tiktok_followers,
    instagram_followers: user.instagram_followers,
    total_followers: user.total_followers,
    influencer_rank: user.influencer_rank,
    has_tiktok_token: hasTikTokToken
  });
  
  const getProgressToNextRank = () => {
    const rankKeys = Object.keys(INFLUENCER_TIERS);
    const currentIndex = rankKeys.indexOf(currentRank);
    
    if (currentIndex === rankKeys.length - 1) return 100;
    
    const nextRankKey = rankKeys[currentIndex + 1];
    const nextRank = INFLUENCER_TIERS[nextRankKey];
    
    const progress = ((totalFollowers - rankData.minFollowers) / (nextRank.minFollowers - rankData.minFollowers)) * 100;
    return Math.min(Math.max(progress, 0), 100);
  };

  const getNextRankInfo = () => {
    const rankKeys = Object.keys(INFLUENCER_TIERS);
    const currentIndex = rankKeys.indexOf(currentRank);
    
    if (currentIndex === rankKeys.length - 1) return null;
    
    const nextRankKey = rankKeys[currentIndex + 1];
    return INFLUENCER_TIERS[nextRankKey];
  };

  const handleLinkTikTok = async () => {
    setIsLinking(true);
    try {
      const response = await startTikTokOAuth();
      if (response.data?.success && response.data?.auth_url) {
        window.location.href = response.data.auth_url;
      } else {
        throw new Error(response.data?.error || 'Failed to initiate TikTok authentication');
      }
    } catch (error) {
      console.error('Error linking TikTok:', error);
      alert('Failed to link TikTok account. Please try again.');
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlink = async () => {
    if (window.confirm("Are you sure you want to unlink your TikTok account? Your TikTok follower count will be removed and your influencer rank will be recalculated.")) {
      setIsUnlinking(true);
      try {
        const response = await unlinkTikTokAccount();
        if (response.data?.success) {
          alert('TikTok account unlinked successfully.');
          if (onUpdate) {
            onUpdate();
          }
        } else {
          throw new Error(response.data?.error || 'Failed to unlink account.');
        }
      } catch (error) {
        console.error("Error unlinking TikTok:", error);
        alert(`Failed to unlink TikTok account: ${error.message}`);
      } finally {
        setIsUnlinking(false);
      }
    }
  };

  const nextRank = getNextRankInfo();
  const progress = getProgressToNextRank();

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3" style={{ background: `linear-gradient(135deg, ${rankData.color}15, ${rankData.color}05)` }}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Crown className="w-5 h-5" style={{ color: rankData.color }} />
            Influencer Rank
          </CardTitle>
          <p className="text-xs text-gray-500">
            Last updated: {user.followers_last_updated ? `${formatDistanceToNow(new Date(user.followers_last_updated))} ago` : 'Never'}
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4">
        <motion.div
          className="text-center p-4 rounded-xl"
          style={{ backgroundColor: `${rankData.color}10` }}
          initial={{ scale: 0.9 }} 
          animate={{ scale: 1 }} 
          transition={{ duration: 0.3 }}
        >
          <div className="text-4xl mb-2">{rankData.emoji}</div>
          <h3 className="text-xl font-bold" style={{ color: rankData.color }}>{rankData.name}</h3>
          <p className="text-sm text-gray-600 mb-2">{rankData.subtitle}</p>
          <p className="text-xs text-gray-500 mb-3">{rankData.description}</p>
          <Badge className="text-white font-semibold" style={{ backgroundColor: rankData.color }}>
            {rankData.multiplier}x Multiplier
          </Badge>
        </motion.div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="p-3 bg-gradient-to-br from-pink-50 to-purple-50 rounded-lg">
              <Instagram className="w-5 h-5 mx-auto mb-1 text-pink-500" />
              <p className="font-bold text-lg">{(user.instagram_followers || 0).toLocaleString()}</p>
              <p className="text-xs text-gray-600">Instagram</p>
            </div>
            <div className="p-3 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg">
              <div className="flex items-center justify-center mb-1">
                <Music className="w-5 h-5 text-black" />
                {hasTikTokToken && <CheckCircle className="w-3 h-3 text-green-500 ml-1" />}
              </div>
              <p className="font-bold text-lg">{(user.tiktok_followers || 0).toLocaleString()}</p>
              <p className="text-xs text-gray-600">
                TikTok {hasTikTokToken ? '(Linked)' : '(Manual)'}
              </p>
            </div>
          </div>
          
          <div className="text-center p-2 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium">Total Followers</p>
            <p className="text-xl font-bold text-gray-900">{totalFollowers.toLocaleString()}</p>
          </div>
        </div>

        {nextRank && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Progress to {nextRank.name}</span>
              <span>{nextRank.minFollowers.toLocaleString()} followers needed</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-gray-500 text-center">
              {(nextRank.minFollowers - totalFollowers) > 0 ? `${(nextRank.minFollowers - totalFollowers).toLocaleString()} followers to go!` : `You've made it!`}
            </p>
          </div>
        )}

        <div className="pt-4 border-t border-gray-200 space-y-2">
          {!hasTikTokToken ? (
            <>
              <Button 
                onClick={handleLinkTikTok} 
                disabled={isLinking} 
                className="w-full bg-black hover:bg-gray-800 text-white"
              >
                {isLinking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LinkIcon className="w-4 h-4 mr-2" />}
                {isLinking ? 'Linking...' : 'Link TikTok Account'}
              </Button>
              <p className="text-xs text-gray-500 text-center px-4 pt-1">
                To connect a different account, first log out from tiktok.com in your browser.
              </p>
            </>
          ) : (
            <div className="flex gap-2">
              <Button onClick={() => handleSync()} disabled={isSyncing} className="w-full" variant="default">
                {isSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                {isSyncing ? 'Syncing...' : 'Sync Counts'}
              </Button>
              <Button onClick={handleUnlink} disabled={isUnlinking} className="w-full" variant="destructive">
                {isUnlinking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                {isUnlinking ? 'Unlinking...' : 'Unlink TikTok'}
              </Button>
            </div>
          )}
        </div>

        {!hasTikTokToken && (
          <div className="bg-amber-50 p-3 rounded-lg">
            <p className="text-xs text-amber-700">
              💡 Link your TikTok account for automatic follower syncing and accurate influencer ranking!
            </p>
          </div>
        )}

        {hasTikTokToken && (
          <div className="bg-amber-50 p-3 rounded-lg">
            <p className="text-xs text-amber-700">
              💡 Follower counts sync automatically. Use 'Sync Counts' for an immediate update.
            </p>
          </div>
        )}

        {currentRank === 'legend' && (
          <div className="text-center p-3 bg-gradient-to-r from-red-50 to-pink-50 rounded-lg">
            <p className="text-sm font-medium text-gray-800">🏆 Maximum Rank Achieved!</p>
            <p className="text-xs text-gray-600">You've reached legendary status!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
