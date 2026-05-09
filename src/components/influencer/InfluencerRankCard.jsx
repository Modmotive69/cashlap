import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { syncAndRankInfluencer } from '@/functions/syncAndRankInfluencer';
import { startTikTokOAuth } from '@/functions/startTikTokOAuth';
import { unlinkTikTokAccount } from '@/functions/unlinkTikTokAccount';
import {
  Music, Crown, Loader2, RefreshCw, Link as LinkIcon,
  CheckCircle, XCircle, TrendingUp, TrendingDown, Minus, User as UserIcon
} from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

const INFLUENCER_TIERS = {
  rookie:      { name: 'Rookie',       subtitle: 'Nano',     emoji: '🐣', description: 'Just starting their rise to fame.',              minFollowers: 0,        maxFollowers: 9999,     multiplier: 1.0,  color: '#94A3B8' },
  trendsetter: { name: 'Trendsetter',  subtitle: 'Micro',    emoji: '🔥', description: 'Sparking buzz and gaining attention.',           minFollowers: 10000,    maxFollowers: 99999,    multiplier: 1.25, color: '#F97316' },
  vibe_curator:{ name: 'Vibe Curator', subtitle: 'Mid-Tier', emoji: '🎶', description: 'Setting trends and building a loyal following.', minFollowers: 100000,   maxFollowers: 999999,   multiplier: 1.5,  color: '#8B5CF6' },
  icon:        { name: 'Icon',         subtitle: 'Macro',    emoji: '🌟', description: 'Recognized everywhere, leading the scene.',      minFollowers: 1000000,  maxFollowers: 9999999,  multiplier: 2.0,  color: '#EAB308' },
  legend:      { name: 'Legend',       subtitle: 'Mega',     emoji: '👑', description: 'Elite status, cultural influencer, unstoppable.', minFollowers: 10000000, maxFollowers: Infinity, multiplier: 3.0,  color: '#DC2626' }
};

export default function InfluencerRankCard({ user, onUpdate }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [lastSyncGrowth, setLastSyncGrowth] = useState(null);

  const handleSync = useCallback(async (isAutoSync = false) => {
    setIsSyncing(true);
    try {
      const response = await syncAndRankInfluencer();
      if (response.data?.success) {
        if (response.data.tiktok_growth !== undefined) {
          setLastSyncGrowth(response.data.tiktok_growth);
        }
        if (onUpdate) onUpdate();
        if (!isAutoSync) {
          const growth = response.data.tiktok_growth;
          const growthText = growth > 0 ? ` (+${growth.toLocaleString()} new followers!)` : growth < 0 ? ` (${growth.toLocaleString()})` : '';
          alert(`Synced! TikTok: ${response.data.tiktok_followers?.toLocaleString()}${growthText}`);
        }
      } else {
        throw new Error(response.data?.error || 'Failed to sync');
      }
    } catch (error) {
      console.error('Error syncing followers:', error);
      alert('Failed to sync TikTok data. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  }, [onUpdate]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('tiktok_success')) {
      window.history.replaceState({}, document.title, window.location.pathname);
      handleSync(true);
    }
  }, [handleSync]);

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
    if (window.confirm("Are you sure you want to unlink your TikTok account? Your follower count will be removed and your rank recalculated.")) {
      setIsUnlinking(true);
      try {
        const response = await unlinkTikTokAccount();
        if (response.data?.success) {
          setLastSyncGrowth(null);
          if (onUpdate) onUpdate();
        } else {
          throw new Error(response.data?.error || 'Failed to unlink account.');
        }
      } catch (error) {
        console.error("Error unlinking TikTok:", error);
        alert(`Failed to unlink TikTok: ${error.message}`);
      } finally {
        setIsUnlinking(false);
      }
    }
  };

  const totalFollowers = user.tiktok_followers || 0;

  // Recalculate rank dynamically from total_followers as source of truth
  const getDynamicRankKey = (followers) => {
    if (followers >= 10000000) return 'legend';
    if (followers >= 1000000) return 'icon';
    if (followers >= 100000) return 'vibe_curator';
    if (followers >= 10000) return 'trendsetter';
    return 'rookie';
  };
  const currentRank = getDynamicRankKey(totalFollowers);
  const rankData = INFLUENCER_TIERS[currentRank];
  const hasTikTokToken = Boolean(user.tiktok_access_token);
  const tiktokFollowers = user.tiktok_followers || 0;
  const previousFollowers = user.tiktok_followers_previous || 0;
  const growth = lastSyncGrowth !== null ? lastSyncGrowth : (tiktokFollowers - previousFollowers);

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
    return INFLUENCER_TIERS[rankKeys[currentIndex + 1]];
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
            {user.followers_last_updated
              ? `Updated ${formatDistanceToNow(new Date(user.followers_last_updated))} ago`
              : 'Never synced'}
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4">
        {/* Rank Badge */}
        <motion.div
          className="text-center p-4 rounded-xl"
          style={{ backgroundColor: `${rankData.color}10` }}
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="text-4xl mb-2">{rankData.emoji}</div>
          <h3 className="text-xl font-bold" style={{ color: rankData.color }}>{rankData.name}</h3>
          <p className="text-sm text-gray-600 mb-1">{rankData.subtitle}</p>
          <p className="text-xs text-gray-500 mb-3">{rankData.description}</p>
          <Badge className="text-white font-semibold" style={{ backgroundColor: rankData.color }}>
            {rankData.multiplier}x Reward Multiplier
          </Badge>
        </motion.div>

        {/* TikTok Profile Section */}
        {hasTikTokToken ? (
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {user.tiktok_avatar_url ? (
                  <img
                    src={user.tiktok_avatar_url}
                    alt="TikTok avatar"
                    className="w-14 h-14 rounded-full object-cover border-2 border-white shadow"
                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                  />
                ) : null}
                <div
                  className="w-14 h-14 rounded-full bg-gray-200 items-center justify-center border-2 border-white shadow"
                  style={{ display: user.tiktok_avatar_url ? 'none' : 'flex' }}
                >
                  <UserIcon className="w-6 h-6 text-gray-400" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-black rounded-full p-1">
                  <Music className="w-3 h-3 text-white" />
                </div>
              </div>

              {/* Name & Handle */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-gray-900 truncate">
                    {user.tiktok_username || 'TikTok Account'}
                  </p>
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                </div>
                {user.social_handles?.tiktok && (
                  <p className="text-xs text-gray-500 truncate">@{user.social_handles.tiktok}</p>
                )}
                {user.tiktok_bio && (
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">{user.tiktok_bio}</p>
                )}
              </div>
            </div>

            {/* Follower Count & Growth */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                <p className="text-2xl font-bold text-gray-900">{tiktokFollowers.toLocaleString()}</p>
                <p className="text-xs text-gray-500">TikTok Followers</p>
              </div>
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                {growth > 0 ? (
                  <>
                    <div className="flex items-center justify-center gap-1">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      <p className="text-2xl font-bold text-green-600">+{growth.toLocaleString()}</p>
                    </div>
                    <p className="text-xs text-gray-500">Growth Since Last Sync</p>
                  </>
                ) : growth < 0 ? (
                  <>
                    <div className="flex items-center justify-center gap-1">
                      <TrendingDown className="w-4 h-4 text-red-500" />
                      <p className="text-2xl font-bold text-red-600">{growth.toLocaleString()}</p>
                    </div>
                    <p className="text-xs text-gray-500">Growth Since Last Sync</p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-center gap-1">
                      <Minus className="w-4 h-4 text-gray-400" />
                      <p className="text-2xl font-bold text-gray-500">0</p>
                    </div>
                    <p className="text-xs text-gray-500">Growth Since Last Sync</p>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Not linked — show prompt */
          <div className="bg-gray-900 rounded-xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
              <Music className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-white">Link Your TikTok</p>
              <p className="text-xs text-gray-400 mt-0.5">Connect to sync followers & boost your rank multiplier</p>
            </div>
          </div>
        )}

        {/* TikTok Follower Total */}
        <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-black rounded-full flex items-center justify-center flex-shrink-0">
              <Music className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-medium text-gray-700">TikTok Followers</span>
          </div>
          <span className="text-sm font-bold text-gray-900">{totalFollowers.toLocaleString()}</span>
        </div>

        {/* Progress to next rank */}
        {nextRank && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700">Progress to {nextRank.emoji} {nextRank.name}</span>
              <span className="text-gray-500 text-xs">{nextRank.minFollowers.toLocaleString()} needed</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-gray-500 text-center">
              {nextRank.minFollowers - totalFollowers > 0
                ? `${(nextRank.minFollowers - totalFollowers).toLocaleString()} followers to go!`
                : "You've reached this rank!"}
            </p>
          </div>
        )}

        {currentRank === 'legend' && (
          <div className="text-center p-3 bg-gradient-to-r from-red-50 to-pink-50 rounded-lg">
            <p className="text-sm font-medium text-gray-800">🏆 Maximum Rank Achieved!</p>
            <p className="text-xs text-gray-600">You've reached legendary status!</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 border-t border-gray-200 space-y-2">
          {!hasTikTokToken ? (
            <>
              <Button onClick={handleLinkTikTok} disabled={isLinking} className="w-full bg-black hover:bg-gray-800 text-white">
                {isLinking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LinkIcon className="w-4 h-4 mr-2" />}
                {isLinking ? 'Linking...' : 'Link TikTok Account'}
              </Button>
              <p className="text-xs text-gray-500 text-center">
                To connect a different account, first log out from tiktok.com.
              </p>
            </>
          ) : (
            <div className="flex gap-2">
              <Button onClick={() => handleSync(false)} disabled={isSyncing} className="flex-1">
                {isSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </Button>
              <Button onClick={handleUnlink} disabled={isUnlinking} variant="destructive" className="flex-1">
                {isUnlinking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                {isUnlinking ? 'Unlinking...' : 'Unlink'}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}