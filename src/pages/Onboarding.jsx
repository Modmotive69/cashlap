import { useState, useEffect } from 'react';
import { User, Business } from '@/entities/all';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { createPageUrl } from '@/utils';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  MapPin,
  Users,
  Briefcase,
  TrendingUp,
  Target,
  Loader2,
  Sparkles
} from 'lucide-react';
import StepInterests from '@/components/onboarding/StepInterests';
import StepEngagement from '@/components/onboarding/StepEngagement';
import StepBusinessProfile from '@/components/onboarding/StepBusinessProfile';
import StepBusinessBaseline from '@/components/onboarding/StepBusinessBaseline';
import { createNotification } from '@/functions/createNotification';

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const [accountType, setAccountType] = useState('');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');

  const [playerData, setPlayerData] = useState({
    favorite_categories: [],
    engagement_preferences: [],
  });
  const [businessData, setBusinessData] = useState({
    business_name: '',
    business_description: '',
    business_website: '',
    business_address: '',
    category: '',
    average_daily_traffic: '',
  });

  const handleBusinessDataUpdate = (newData) => {
    setBusinessData(prev => ({ ...prev, ...newData }));
  };

  const playerSteps = [
    {
      title: "What interests you?",
      subtitle: "Tell us about your preferences so we can personalize your experience.",
      color: "from-emerald-500 to-teal-600",
      icon: <Sparkles className="w-12 h-12 text-white" />,
      component: <StepInterests userData={playerData} onUpdate={data => setPlayerData(prev => ({...prev, ...data}))} />
    },
    {
      title: "How do you engage?",
      subtitle: "Choose the activities you enjoy most to help us match you with the right opportunities.",
      color: "from-blue-500 to-indigo-600",
      icon: <Target className="w-12 h-12 text-white" />,
      component: <StepEngagement userData={playerData} onUpdate={data => setPlayerData(prev => ({...prev, ...data}))} />
    }
  ];

  const businessSteps = [
    {
      title: "Welcome to your business growth platform",
      subtitle: "Join thousands of businesses using CashLap to attract customers and boost engagement through strategic campaigns.",
      icon: <Briefcase className="w-12 h-12 text-white" />,
      color: "from-blue-600 to-purple-700",
      content: "CashLap connects your business with engaged customers through location-based campaigns. Create missions that bring people to your door, increase your social media presence, and build lasting customer relationships.",
      image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/7fb211cbf_20250614_1120_JellyCubeCheckoutEncounter_remix_01jxqkrjmgeq5s43t2vgyc6hth.png",
      features: [
        "Create engaging location-based campaigns",
        "Track customer visits and social engagement",
        "Build authentic brand awareness",
        "Access detailed analytics and insights"
      ]
    },
    {
      title: "Tell us about your business",
      subtitle: "Help customers discover what makes your business special.",
      icon: <MapPin className="w-12 h-12 text-white" />,
      color: "from-orange-500 to-red-600",
      component: <StepBusinessProfile businessData={businessData} onUpdate={handleBusinessDataUpdate} />
    },
    {
      title: "Set your baseline metrics",
      subtitle: "Track your growth and measure campaign success against your current performance.",
      icon: <TrendingUp className="w-12 h-12 text-white" />,
      color: "from-green-500 to-emerald-600",
      component: <StepBusinessBaseline businessData={businessData} onUpdate={handleBusinessDataUpdate} />
    }
  ];

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      setLoading(true);
      setError('');
      try {
        let currentUser = await User.me();
        
        const intendedType = localStorage.getItem('intended_account_type');
        if (intendedType && !currentUser.account_type) {
            console.log(`User logged in, setting intended account type to: ${intendedType}`);
            localStorage.removeItem('intended_account_type');
            await User.updateMyUserData({ account_type: intendedType });
            currentUser = await User.me(); 
        }
        
        setUser(currentUser);
        setIsAuthenticated(true);
  
        if (currentUser.onboarding_completed) {
          window.location.href = createPageUrl('Dashboard');
          return; // keep loading=true until redirect
        }
  
        if (currentUser.account_type) {
          setAccountType(currentUser.account_type);
        }
        
        setLoading(false);
  
      } catch (error) {
        // User is not authenticated — redirect to login and keep the spinner
        // so mobile users don't see a broken intermediate state
        setIsAuthenticated(false);
        base44.auth.redirectToLogin(window.location.href);
        // intentionally keep loading=true so spinner stays until redirect completes
      }
    };
    checkAuthAndRedirect();
  }, []);

  const handleLogin = () => {
    setLoading(true); // keep spinner visible until redirect completes
    base44.auth.redirectToLogin(window.location.href);
  };

  const handleAccountTypeSelect = async (type) => {
    setAccountType(type);
    setError('');
    if (isAuthenticated && user) {
      try {
        await User.updateMyUserData({ account_type: type, onboarding_completed: false });
        setCurrentStep(0);
      } catch (error) {
        console.error("Error updating account type:", error);
        setError("Failed to update account type. Please try again.");
      }
    }
  };

  const completeOnboarding = async () => {
    setLoading(true);
    setError('');

    try {
      const currentUser = user || await User.me();
      let finalUser;

      if (accountType === 'player') {
        const updateData = {
          onboarding_completed: true,
          account_type: 'player',
          display_name: currentUser.full_name || currentUser.email?.split('@')[0] || 'User',
          favorite_categories: playerData.favorite_categories,
          engagement_preferences: playerData.engagement_preferences,
        };
        await User.updateMyUserData(updateData);
      } else if (accountType === 'business') {
        const newBusiness = await Business.create({
            name: businessData.business_name,
            description: businessData.business_description,
            address: businessData.business_address,
            website: businessData.business_website,
            category: businessData.category || 'services',
            business_owner_id: currentUser.id,
        });

        const updateUserWithBusinessData = {
            onboarding_completed: true,
            account_type: 'business',
            display_name: businessData.business_name || currentUser.full_name,
            business_id: newBusiness.id,
        };
        await User.updateMyUserData(updateUserWithBusinessData);
      }

      finalUser = await User.me();

      try {
        if (accountType === 'player') {
          await createNotification({
            userId: finalUser.id,
            type: 'welcome',
            title: '🎉 Welcome to CashLap!',
            message: 'Start exploring local businesses and earning rewards!',
            linkUrl: '/Explore'
          });
        } else if (accountType === 'business') {
           await createNotification({
            userId: finalUser.id,
            type: 'welcome',
            title: '🏪 Welcome to CashLap Business!',
            message: 'Create campaigns to attract customers and boost your social media presence!',
            linkUrl: '/CampaignManager'
          });
        }
      } catch (welcomeError) {
        console.error('Failed to create direct welcome notifications:', welcomeError);
      }

      window.location.href = createPageUrl('Dashboard');

    } catch (err) {
      console.error('Onboarding error:', err);
      setError('Failed to complete onboarding. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    const steps = accountType === 'player' ? playerSteps : businessSteps;
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeOnboarding();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Getting Ready...</h2>
          <p className="text-gray-600">Setting up your personalized experience</p>
        </div>
      </div>
    );
  }

  const steps = accountType === 'player' ? playerSteps : businessSteps;
  const currentStepData = steps[currentStep];

  return (
    <div className="flex flex-col h-[100dvh] bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-md mx-auto w-full flex flex-col flex-1 px-4">
        {!accountType ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex items-center justify-center py-8"
          >
            <div className="w-full space-y-8 text-center">
              <div>
                <div className="w-20 h-20 mx-auto mb-6 bg-white rounded-full shadow-lg flex items-center justify-center">
                  <img
                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/35bcc7111_ffb153679_Group40.png"
                    alt="CashLap"
                    className="w-12 h-12 object-contain"
                  />
                </div>
                <h1 className="text-3xl font-bold text-gray-800 mb-3">Welcome to CashLap</h1>
                <p className="text-lg text-gray-600 leading-relaxed max-w-sm mx-auto">
                  Choose your path to get started with a tailored experience designed just for you
                </p>
              </div>

              <div className="space-y-4 mt-12">
                <motion.div
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleAccountTypeSelect('player')}
                  className="cursor-pointer"
                >
                  <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-emerald-500 to-teal-600 text-white overflow-hidden">
                    <CardContent className="p-6 relative">
                      <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
                        <Users className="w-full h-full" />
                      </div>
                      <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-3">
                          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                            <Users className="w-6 h-6 text-white" />
                          </div>
                          <div className="text-left">
                            <h3 className="text-xl font-bold">I'm a Player</h3>
                            <p className="text-emerald-100 text-sm">Explore • Earn • Engage</p>
                          </div>
                        </div>
                        <p className="text-emerald-100 text-sm leading-relaxed">
                          Discover amazing local businesses, complete exciting missions, and earn rewards while building your influence in the community
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleAccountTypeSelect('business')}
                  className="cursor-pointer"
                >
                  <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-blue-600 to-purple-700 text-white overflow-hidden">
                    <CardContent className="p-6 relative">
                      <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
                        <Briefcase className="w-full h-full" />
                      </div>
                      <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-3">
                          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                            <Briefcase className="w-6 h-6 text-white" />
                          </div>
                          <div className="text-left">
                            <h3 className="text-xl font-bold">I'm a Business Owner</h3>
                            <p className="text-blue-100 text-sm">Grow • Connect • Thrive</p>
                          </div>
                        </div>
                        <p className="text-blue-100 text-sm leading-relaxed">
                          Attract new customers, increase your social media presence, and grow your business with targeted location-based campaigns
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <>
            {/* Hero Header */}
            <div className="pt-8 pb-6 flex-shrink-0">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl p-6 bg-gradient-to-r ${currentStepData.color} text-white shadow-lg`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                    {currentStepData.icon}
                  </div>
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold mb-2 leading-tight">{currentStepData.title}</h1>
                    <p className="text-white/90 text-sm leading-relaxed">{currentStepData.subtitle}</p>
                  </div>
                </div>
              </motion.div>

              {/* Progress */}
              <div className="mt-6 px-2">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-600">Step {currentStep + 1} of {steps.length}</span>
                  <span className="text-sm text-gray-500">{Math.round(((currentStep + 1) / steps.length) * 100)}% Complete</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <motion.div
                    className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600"
                    initial={{ width: 0 }}
                    animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                    transition={{ type: "spring", stiffness: 100, damping: 20 }}
                  />
                </div>
              </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto pb-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="px-2"
                >
                  {currentStepData.component || (
                    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                      <CardContent className="p-6">
                        {currentStepData.image && (
                          <div className="mb-6">
                            <img 
                              src={currentStepData.image} 
                              alt="Business Growth" 
                              className="w-full h-48 object-cover rounded-lg"
                            />
                          </div>
                        )}
                        {currentStepData.content && (
                          <p className="text-gray-700 leading-relaxed mb-6">{currentStepData.content}</p>
                        )}
                        {currentStepData.features && (
                          <div className="space-y-3">
                            {currentStepData.features.map((feature, index) => (
                              <motion.div
                                key={index}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg"
                              >
                                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                                  <Check className="w-4 h-4 text-white" />
                                </div>
                                <span className="text-gray-700 font-medium">{feature}</span>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Navigation Footer */}
            <div className="py-6 flex-shrink-0 px-2">
              <div className="flex justify-between items-center gap-4 mb-4">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                  className="flex items-center gap-2 px-6 py-3 h-auto border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>

                <Button
                  onClick={handleNext}
                  className="flex items-center gap-2 px-6 py-3 h-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
                >
                  {currentStep === steps.length - 1 ? 'Complete Setup' : 'Continue'}
                  {currentStep < steps.length - 1 ? <ArrowRight className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                </Button>
              </div>
              
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-red-600 text-sm text-center">{error}</p>
                </div>
              )}
              
              <div className="text-center">
                <button
                  onClick={completeOnboarding}
                  className="text-gray-500 hover:text-gray-700 text-sm underline font-medium"
                >
                  Skip setup for now
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}