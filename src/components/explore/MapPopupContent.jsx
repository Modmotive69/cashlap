import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Coins, QrCode, Star, Building, ChevronDown, ChevronUp, CheckSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function MapPopupContent({ campaign, handleStartMission }) {
    const [showRequirements, setShowRequirements] = useState(false);
    
    const getCategoryIcon = (category) => {
        const icons = {
            restaurant: "🍽️",
            cafe: "☕",
            retail: "🛍️",
            fitness: "💪",
            beauty: "💄",
            entertainment: "🎬",
            services: "🔧",
            health: "🏥"
        };
        return icons[category] || "📍";
    };

    return (
        <div className="w-full max-w-[280px] bg-white rounded-lg overflow-hidden">
            {/* Header Section with Image */}
            {campaign.image_url && (
                <div className="relative h-20 w-full">
                    <img
                        src={campaign.image_url}
                        alt={campaign.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            e.target.style.display = 'none';
                        }}
                    />
                </div>
            )}

            {/* Content Section */}
            <div className="p-4 space-y-3">
                {/* Reward Amount */}
                <div className="flex justify-between items-start">
                    <Badge className="bg-[var(--cashlap-green)] text-white font-bold text-sm shadow-md">
                        <Coins className="w-3 h-3 mr-1" />
                        ${campaign.reward_amount}
                    </Badge>
                    {campaign.category && (
                        <Badge variant="outline" className="text-xs">
                            {getCategoryIcon(campaign.category)} {campaign.category}
                        </Badge>
                    )}
                </div>

                {/* Title and Business */}
                <div className="space-y-2">
                    <h3 className="font-bold text-gray-900 text-lg leading-tight line-clamp-2">
                        {campaign.title}
                    </h3>
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-gray-600 font-medium truncate">
                            <Building className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{campaign.business?.name || 'Business'}</span>
                        </div>
                        {campaign.business?.rating && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <Star className="w-4 h-4 text-yellow-500 fill-current" />
                                <span className="font-medium text-gray-700">{campaign.business.rating}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Location and Distance */}
                <div className="space-y-1 pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <p className="flex-1 min-w-0 text-sm text-gray-600 leading-tight line-clamp-2">
                            {campaign.location?.address || 'Address not available'}
                        </p>
                    </div>
                    {campaign.distance && (
                        <p className="pl-6 text-sm text-[var(--cashlap-green)] font-semibold">
                            {campaign.distance.toFixed(1)} mi away
                        </p>
                    )}
                </div>

                {/* Description */}
                {campaign.description && (
                    <div className="pt-2 border-t border-gray-100">
                        <p className="text-sm text-gray-600 line-clamp-3">{campaign.description}</p>
                    </div>
                )}

                {/* Requirements Section */}
                {campaign.requirements && campaign.requirements.length > 0 && (
                    <div className="pt-2 border-t border-gray-100">
                        <button
                            onClick={() => setShowRequirements(!showRequirements)}
                            className="w-full flex items-center justify-between text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors py-1"
                        >
                            <div className="flex items-center gap-2">
                                <CheckSquare className="w-4 h-4" />
                                <span>Mission Requirements</span>
                            </div>
                            {showRequirements ? (
                                <ChevronUp className="w-4 h-4" />
                            ) : (
                                <ChevronDown className="w-4 h-4" />
                            )}
                        </button>
                        
                        <AnimatePresence>
                            {showRequirements && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    <div className="mt-2 p-3 bg-blue-50 rounded-md border border-blue-100">
                                        <ul className="space-y-1">
                                            {campaign.requirements.map((requirement, index) => (
                                                <li key={index} className="flex items-start gap-2 text-sm text-blue-800">
                                                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></span>
                                                    <span className="leading-relaxed">{requirement}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}

                {/* Action Button */}
                <Button
                    onClick={() => handleStartMission(campaign)}
                    className="w-full bg-[var(--cashlap-green)] hover:bg-[var(--cashlap-green)]/90 text-white font-semibold h-10 text-sm rounded-lg shadow-sm mt-3"
                >
                    <QrCode className="w-4 h-4 mr-2" />
                    Start Mission
                </Button>
            </div>
        </div>
    );
}