import { Badge } from '@/components/ui/badge';
import { TrendingUp } from 'lucide-react';

const INFLUENCER_TIERS = {
  rookie: { emoji: '🐣', name: 'Rookie', color: '#94A3B8' },
  trendsetter: { emoji: '🔥', name: 'Trendsetter', color: '#F97316' },
  vibe_curator: { emoji: '🎶', name: 'Vibe Curator', color: '#8B5CF6' },
  icon: { emoji: '🌟', name: 'Icon', color: '#EAB308' },
  legend: { emoji: '👑', name: 'Legend', color: '#DC2626' }
};

export default function MissionRewardDisplay({ baseReward, user, showMultiplier = true, size = 'default' }) {
  const influencerRank = user?.influencer_rank || 'rookie';
  const multiplier = user?.influencer_multiplier || 1.0;
  const finalReward = baseReward * multiplier;
  const tierData = INFLUENCER_TIERS[influencerRank];
  
  const isSmall = size === 'small';
  
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1">
        <span className={`font-bold text-[var(--cashlap-green)] ${isSmall ? 'text-sm' : 'text-lg'}`}>
          ${finalReward.toFixed(2)}
        </span>
        {multiplier > 1.0 && (
          <span className={`text-gray-500 line-through ${isSmall ? 'text-xs' : 'text-sm'}`}>
            ${baseReward.toFixed(2)}
          </span>
        )}
      </div>
      
      {showMultiplier && multiplier > 1.0 && (
        <Badge 
          className={`text-white font-semibold ${isSmall ? 'text-xs px-1.5 py-0.5' : 'text-xs'}`}
          style={{ backgroundColor: tierData.color }}
        >
          <span className="mr-1">{tierData.emoji}</span>
          {multiplier}x
        </Badge>
      )}
      
      {showMultiplier && multiplier > 1.0 && (
        <div className={`flex items-center gap-1 ${isSmall ? 'text-xs' : 'text-sm'} text-gray-600`}>
          <TrendingUp className={`${isSmall ? 'w-3 h-3' : 'w-4 h-4'}`} />
          <span>Influencer Bonus</span>
        </div>
      )}
    </div>
  );
}