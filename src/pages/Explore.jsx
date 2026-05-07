import { useState, useEffect, useCallback } from "react";
import { Business, User, Campaign } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Search,
  MapPin,
  Star,
  Coins,
  Navigation,
  Map as MapIcon,
  List as ListIcon,
  X,
  QrCode,
  AlertTriangle,
  Filter,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createPageUrl } from "@/utils";
import QRScanner from "@/components/qr/QRScanner";
import SimpleMap from "@/components/explore/SimpleMap";
import AuthGuard from "@/components/auth/AuthGuard";

const categories = [
  { value: "all", label: "All Categories" },
  { value: "restaurant", label: "Restaurant" },
  { value: "cafe", label: "Cafe" },
  { value: "retail", label: "Retail" },
  { value: "fitness", label: "Fitness" },
  { value: "beauty", label: "Beauty" },
  { value: "entertainment", label: "Entertainment" },
  { value: "services", label: "Services" },
  { value: "health", label: "Health" }
];

// Helper function to validate MongoDB ObjectId format
const isValidObjectId = (id) => {
  if (!id || typeof id !== 'string') {
    return false;
  }
  return /^[0-9a-fA-F]{24}$/.test(id);
};

function ExploreContent() {
  const [campaigns, setCampaigns] = useState([]);
  const [businesses, setBusinesses] = useState([]); // Will now store actual Business objects
  const [filteredCampaigns, setFilteredCampaigns] = useState([]);
  const [campaignSearchTerm, setCampaignSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [viewMode, setViewMode] = useState("list");
  const [userLocation, setUserLocation] = useState(null);
  const [showQRScanner, setShowQRScanner] = useState(null);
  const [pageError, setPageError] = useState('');
  const [rateLimited, setRateLimited] = useState(false);

  const loadData = useCallback(async () => {
    if (rateLimited) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      console.log('Loading campaigns and verifying business existence...');
      
      const [currentUser, allActiveCampaigns] = await Promise.all([
        User.me(),
        Campaign.filter({ status: 'active' }, '-created_date', 100)
      ]);

      setUser(currentUser);
      console.log('Player user:', currentUser);
      console.log(`Fetched ${allActiveCampaigns.length} active campaigns.`);

      let campaignsWithBusinessData = [];
      let validBusinesses = [];

      if (allActiveCampaigns.length > 0) {
        // Get unique business IDs and filter for valid ObjectId format
        const allBusinessIds = [...new Set(allActiveCampaigns.map(c => c.business_id).filter(id => id))];
        const validFormatBusinessIds = allBusinessIds.filter(isValidObjectId);
        
        // Fetch businesses that exist
        let fetchedBusinesses = [];
        if (validFormatBusinessIds.length > 0) {
          try {
            fetchedBusinesses = await Business.filter({ id: { $in: validFormatBusinessIds } });
          } catch (businessError) {
            if (businessError.response?.status === 429) {
              setRateLimited(true);
              setPageError("Server is busy. Please wait a moment and try again.");
              setTimeout(() => {
                setRateLimited(false);
                setPageError('');
                loadData();
              }, 60000);
              setLoading(false);
              return;
            }
            console.warn('Error fetching businesses:', businessError);
          }
        }

        const businessLookup = new Map(fetchedBusinesses.map(b => [b.id, b]));
        
        // Show ALL active campaigns that have a business_id (even if business record is missing)
        campaignsWithBusinessData = allActiveCampaigns.filter(campaign => {
          return campaign.business_id && campaign.business_id.trim() !== '';
        });

        validBusinesses = fetchedBusinesses;
        console.log(`Displaying ${campaignsWithBusinessData.length} campaigns (${validBusinesses.length} with full business data).`);
      } else {
        console.log("No active campaigns to process.");
      }

      setCampaigns(campaignsWithBusinessData);
      setBusinesses(validBusinesses);
      
    } catch (error) {
      console.error("Error loading explore data:", error);
      
      if (error.response?.status === 429) {
        setRateLimited(true);
        setPageError("Too many requests. Please wait a moment and try again.");
        setTimeout(() => {
          setRateLimited(false);
          setPageError('');
          loadData();
        }, 60000);
      } else {
        setPageError("Failed to load campaigns. Please refresh the page.");
      }
    } finally {
      setLoading(false);
    }
  }, [rateLimited, setLoading, setUser, setCampaigns, setBusinesses, setRateLimited, setPageError]); // Added all state setters and rateLimited as dependencies for correctness.

  const startLocationTracking = useCallback(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        console.log('Player location found:', newLocation);
        setUserLocation(newLocation);
      },
      (error) => {
        console.log("Location error:", error);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, [setUserLocation]);
  
  const filterCampaigns = useCallback(() => {
    console.log('=== FILTERING CAMPAIGNS FOR PLAYERS ===');
    console.log('Available campaigns:', campaigns.length);
    
    // Create a lookup map for businesses
    const businessLookup = new Map(businesses.map(b => [b.id, b]));

    // Process campaigns with actual business data or create fallback business data
    const campaignsWithBusinessData = campaigns.map(campaign => {
      const business = businessLookup.get(campaign.business_id);
      
      // If no business entity exists, create fallback data from campaign or generic defaults
      const fallbackBusiness = {
        id: campaign.business_id,
        name: campaign.business_name || 'Business',
        category: campaign.category || 'services',
        address: campaign.locations?.[0]?.address || 'Location TBD',
        _isFallback: true
      };
      
      return { 
        ...campaign, 
        business: business || fallbackBusiness
      };
    });

    // Apply search and category filters
    let filtered = campaignsWithBusinessData;

    if (campaignSearchTerm && campaignSearchTerm.trim()) {
      const term = campaignSearchTerm.toLowerCase();
      filtered = filtered.filter(campaign =>
        campaign.title.toLowerCase().includes(term) ||
        (campaign.business?.name && campaign.business.name.toLowerCase().includes(term)) ||
        (campaign.description && campaign.description.toLowerCase().includes(term))
      );
    }

    if (selectedCategory !== "all") {
      filtered = filtered.filter(campaign => 
        campaign.category === selectedCategory || 
        (campaign.business?.category === selectedCategory)
      );
    }

    console.log(`Final filtered campaigns for display: ${filtered.length}`);
    setFilteredCampaigns(filtered);
  }, [campaigns, businesses, campaignSearchTerm, selectedCategory, setFilteredCampaigns]);

  useEffect(() => {
    loadData();
    startLocationTracking();
  }, [loadData, startLocationTracking]);

  useEffect(() => {
    filterCampaigns();
  }, [filterCampaigns]);

  const handleStartMission = (campaign) => {
    console.log('Player starting mission for campaign:', campaign.id);
    setShowQRScanner(campaign);
  };

  const handleCheckInSuccess = async (mission) => {
    setShowQRScanner(null);
    
    // Navigate directly to mission submission page with the created mission
    if (mission && mission.id) {
      console.log('Navigating to mission submission with mission:', mission.id);
      window.location.href = `/MissionSubmission?missionId=${mission.id}`;
    } else {
      // Fallback if no mission data is provided
      setPageError("Mission started successfully! Check your dashboard for active missions.");
      setTimeout(() => setPageError(''), 3000);
      loadData();
    }
  };

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

  const handleViewToggle = () => {
    const newMode = viewMode === 'list' ? 'map' : 'list';
    console.log(`Switching view from ${viewMode} to ${newMode}`);
    setViewMode(newMode);
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-gray-50">
        <div className="p-6 space-y-6">
          <div className="h-16 bg-white rounded-xl shadow-sm animate-pulse" />
          <div className="h-12 bg-white rounded-lg animate-pulse" />
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-40 bg-white rounded-xl shadow-sm animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <AnimatePresence>
        {showQRScanner && (
          <QRScanner
            campaign={showQRScanner}
            user={user}
            onCheckInSuccess={handleCheckInSuccess}
            onClose={() => setShowQRScanner(null)}
          />
        )}
      </AnimatePresence>

      {pageError && (
        <div className="fixed top-20 left-4 right-4 z-[60] max-w-md mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: -20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className={`p-4 bg-white border rounded-xl shadow-lg flex items-start gap-3 ${rateLimited ? 'border-amber-200' : 'border-green-200'}`}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${rateLimited ? 'bg-amber-100' : 'bg-green-100'}`}>
              {rateLimited ? <AlertTriangle className="w-3 h-3 text-amber-600" /> : <Star className="w-3 h-3 text-green-600" />}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{pageError}</p>
            </div>
            <Button variant="ghost" size="icon" className="flex-shrink-0 h-6 w-6" onClick={() => setPageError('')}>
              <X className="w-4 h-4" />
            </Button>
          </motion.div>
        </div>
      )}

      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 space-y-3 flex-shrink-0 relative z-30">
        {/* Title and View Toggle */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-gray-900">Discover</h1>
            <p className="text-xs text-gray-500 mt-0.5">Find local campaigns and start earning</p>
          </div>
          <div className="flex items-center bg-gray-100 rounded-lg p-1 flex-shrink-0">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium rounded-md transition-all ${
                viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ListIcon className="w-4 h-4" />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium rounded-md transition-all ${
                viewMode === 'map' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <MapIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Map</span>
            </button>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search campaigns..."
              value={campaignSearchTerm}
              onChange={(e) => setCampaignSearchTerm(e.target.value)}
              className="pl-9 h-9 border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm"
              disabled={rateLimited}
            />
          </div>
          <div className="flex-shrink-0">
            <Select value={selectedCategory} onValueChange={setSelectedCategory} disabled={rateLimited}>
              <SelectTrigger className="w-32 sm:w-40 h-9 border-gray-300 text-sm">
                <Filter className="w-3.5 h-3.5 mr-1.5 text-gray-400 flex-shrink-0" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="z-[9999]">
                {categories.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Main Content Area - Fills remaining space exactly */}
      <div className="flex-1 min-h-0">
        {viewMode === "map" ? (
          <div className="w-full h-full relative z-10">
            <SimpleMap
              campaigns={filteredCampaigns}
              userLocation={userLocation}
              onMarkerClick={handleStartMission}
            />
          </div>
        ) : (
          <div className="h-full overflow-y-auto bg-gray-50">
            <div className="p-4 space-y-4 pb-24">
              {filteredCampaigns.length === 0 && !rateLimited ? ( // Show no campaigns message only if not rate-limited
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <Navigation className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No campaigns found</h3>
                  <p className="text-gray-600 max-w-sm">
                    Try adjusting your search criteria or check back later for new opportunities
                  </p>
                  <div className="mt-4 px-3 py-1 bg-gray-100 rounded-full">
                    <p className="text-xs text-gray-500">{campaigns.length} total valid campaigns available</p>
                  </div>
                </div>
              ) : filteredCampaigns.length === 0 && rateLimited ? ( // Show specific message if rate-limited
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                    <AlertTriangle className="w-8 h-8 text-amber-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-amber-800 mb-2">Too Many Requests</h3>
                  <p className="text-amber-700 max-w-sm">
                    The server is busy. Please wait a moment and try refreshing the page.
                  </p>
                  <Button onClick={() => loadData()} className="mt-4">Try Again</Button>
                </div>
              ) : (
                <>
                  {/* Results Header */}
                  <div className="flex items-center justify-between pb-2">
                    <p className="text-sm text-gray-600">
                      {filteredCampaigns.length} campaign{filteredCampaigns.length !== 1 ? 's' : ''} found
                    </p>
                  </div>

                  {/* Campaign Cards */}
                  <div className="space-y-4">
                    {filteredCampaigns.map((campaign) => (
                      <motion.div
                        key={campaign.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200"
                      >
                        {campaign.image_url && (
                          <div className="relative h-48 bg-gray-100">
                            <img
                              src={campaign.image_url}
                              alt={campaign.title}
                              className="w-full h-full object-cover"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                            <div className="absolute top-3 left-3">
                              <Badge className="bg-white/95 text-gray-700 border border-gray-200">
                                {getCategoryIcon(campaign.category || campaign.business.category)} {campaign.category || campaign.business.category}
                              </Badge>
                            </div>
                            <div className="absolute top-3 right-3">
                              <Badge className="bg-green-500 text-white font-semibold shadow-sm">
                                <Coins className="w-3 h-3 mr-1" />
                                ${campaign.reward_amount}
                              </Badge>
                            </div>
                          </div>
                        )}
                        
                        <div className="p-5">
                          <div className="space-y-3">
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900 leading-tight">
                                {campaign.title}
                              </h3>
                              <p className="text-gray-600 mt-1">{campaign.business.name}</p>
                              <div className="flex items-start gap-2 mt-2">
                                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                <span className="text-sm text-gray-500 leading-tight">
                                  {campaign.locations?.[0]?.address || campaign.business.address || 'Location TBD'}
                                </span>
                              </div>
                              {campaign.business._isFallback && (
                                <p className="text-xs text-amber-600 mt-1">⚠️ Business details may be limited</p>
                              )}
                            </div>

                            {campaign.description && (
                              <p className="text-gray-700 text-sm leading-relaxed">{campaign.description}</p>
                            )}

                            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                              <div className="flex items-center gap-4">
                                {/* Removed campaign.business.rating display as it's no longer fetched */}
                                <Badge variant="outline" className="text-xs border-gray-300">
                                  {campaign.locations?.length || 0} location{campaign.locations?.length !== 1 ? 's' : ''}
                                                </Badge>
                              </div>

                              <Button
                                onClick={() => handleStartMission(campaign)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 h-9"
                                disabled={rateLimited}
                              >
                                <QrCode className="w-4 h-4 mr-2" />
                                Check In
                              </Button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Explore() {
  return (
    <AuthGuard
      requireAuth={true}
      requiredAccountType="player"
      fallbackUrl="Dashboard"
    >
      <ExploreContent />
    </AuthGuard>
  );
}