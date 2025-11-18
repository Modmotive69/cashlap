
import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User } from "@/entities/User";
import { Home, Map, User as UserIcon, TrendingUp, BarChart3, Target } from "lucide-react";
import CashChatbot from "@/components/chat/CashChatbot";
import { useInactivityLogout } from "@/components/auth/useInactivityLogout";
import NotificationBell from '@/components/notifications/NotificationBell';

const navigationItems = [
  {
    title: "Home",
    url: createPageUrl("Dashboard"),
    icon: Home,
  },
  {
    title: "Explore",
    url: createPageUrl("Explore"),
    icon: Map,
  },
  {
    title: "Analytics",
    url: createPageUrl("Analytics"),
    icon: TrendingUp,
  },
  {
    title: "Profile",
    url: createPageUrl("Profile"),
    icon: UserIcon,
  },
];

const businessNavigationItems = [
  {
    title: "Dashboard",
    url: createPageUrl("Dashboard"),
    icon: Home,
  },
  {
    title: "Campaigns",
    url: createPageUrl("CampaignManager"),
    icon: Target,
  },
  {
    title: "Analytics",
    url: createPageUrl("BusinessAnalytics"),
    icon: BarChart3,
  },
  {
    title: "Profile",
    url: createPageUrl("Profile"),
    icon: UserIcon,
  },
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [accountType, setAccountType] = useState(null); // Start with null to indicate loading
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  useInactivityLogout(isAuthenticated);

  // Enhanced account type detection with better persistence
  useEffect(() => {
    const fetchUserAccountType = async () => {
      // List of pages that have their own custom, full-screen layout
      const fullScreenPages = ['SignIn', 'Onboarding', 'CameraCapture', 'PaymentSuccess', 'MissionSubmission', 'ARMap'];
      
      // Skip auth checks for these pages
      if (fullScreenPages.includes(currentPageName)) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        // Get fresh user data from the server
        const user = await User.me();
        console.log('[Layout] Current user data:', {
          id: user.id,
          email: user.email,
          account_type: user.account_type,
          onboarding_completed: user.onboarding_completed
        });

        if (user && user.account_type) {
          // Use the account type from the server
          console.log(`[Layout] Setting account type to: ${user.account_type}`);
          setAccountType(user.account_type);
          setIsAuthenticated(true);
          
          // Cache the account type for faster loading next time
          localStorage.setItem('cached_account_type', user.account_type);
        } else {
          console.warn('[Layout] User found but no account_type set, defaulting to player');
          setIsAuthenticated(true);
          setAccountType('player');
        }
      } catch (error) {
        console.warn('[Layout] Could not fetch user account type:', error);
        setIsAuthenticated(false);
        
        // Try to use cached account type as fallback
        const cachedType = localStorage.getItem('cached_account_type');
        if (cachedType) {
          console.log(`[Layout] Using cached account type: ${cachedType}`);
          setAccountType(cachedType);
        } else {
          setAccountType('player');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserAccountType();
  }, [currentPageName]); // Only depend on page name

  const formatPageTitle = (pageName) => {
    if (!pageName) return "";
    const spacedName = pageName.replace(/([A-Z])/g, ' $1').trim();
    if (spacedName === 'Sign In') return 'Sign In';
    if (spacedName === 'Security') return 'Security & Privacy';
    return spacedName;
  };

  const isFullScreenPage = ['SignIn', 'Onboarding', 'CameraCapture', 'PaymentSuccess', 'MissionSubmission', 'ARMap'].includes(currentPageName);

  // Show loading state briefly while determining account type
  if (isLoading && !isFullScreenPage) {
    return (
      <>
        <style>
          {`
            :root {
              --cashlap-green: #32CD32;
              --cashlap-pink: #FF1493;
              --cashlap-blue: #1E90FF;
              --cashlap-yellow: #FFD700;
              --cashlap-orange: #FF4500;
              --cashlap-light-green: #32CD32;
              --cashlap-light-blue: #4A90E2;
              --navbar-height: 80px;
            }
            
            body {
              -webkit-text-size-adjust: 100%;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
              font-size: 16px;
            }
            
            html, body, #root {
              height: 100%;
              overflow: hidden;
            }
          `}
        </style>
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
          <div className="w-8 h-8 border-2 border-[var(--cashlap-green)] border-t-transparent rounded-full animate-spin"></div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>
        {`
          :root {
            --cashlap-green: #32CD32;
            --cashlap-pink: #FF1493;
            --cashlap-blue: #1E90FF;
            --cashlap-yellow: #FFD700;
            --cashlap-orange: #FF4500;
            --cashlap-light-green: #32CD32;
            --cashlap-light-blue: #4A90E2;
            --navbar-height: 80px;
          }
          
          body {
            -webkit-text-size-adjust: 100%;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            font-size: 16px;
          }
          
          html, body, #root {
            height: 100%;
            overflow: hidden;
          }
          
          input[type="text"],
          input[type="email"],
          input[type="number"],
          input[type="password"],
          input[type="search"],
          select,
          textarea {
            font-size: 16px !important;
          }
          
          .main-content {
            overflow-x: hidden;
            -webkit-overflow-scrolling: touch;
            scroll-behavior: smooth;
          }
        `}
      </style>
    
      {isFullScreenPage ? (
        <>{children}</>
      ) : (
        <div className="flex flex-col h-[100dvh] bg-gray-100 overflow-hidden">
          <header className="sticky top-0 bg-white/80 backdrop-blur-sm z-20 border-b border-gray-200 flex-shrink-0" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
              <div className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0">
                <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/35bcc7111_ffb153679_Group40.png" alt="CashLap Logo" className="w-full h-full object-contain" />
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate mx-2">{formatPageTitle(currentPageName)}</h1>
              <div className="w-8 h-8 sm:w-10 sm:h-10 flex justify-end flex-shrink-0">
                {isAuthenticated && <NotificationBell />}
              </div>
            </div>
          </header>

          <main className="main-content flex-1 bg-gray-100 overflow-y-auto">
            <div className="max-w-md mx-auto h-full">
              <div className="h-full">
                {children}
              </div>
            </div>
          </main>

          <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 z-[9999] flex-shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="max-w-md mx-auto">
              <div className="flex items-center justify-around py-2 px-2">
                {/* Only show navigation if we have determined the account type */}
                {accountType && (accountType === 'business' ? businessNavigationItems : navigationItems).map((item) => {
                  const isActive = location.pathname === item.url;
                  return (
                    <Link
                      key={item.title}
                      to={item.url}
                      className={`flex flex-col items-center justify-center gap-1 p-3 rounded-lg transition-all duration-200 min-w-0 flex-1 touch-manipulation ${
                        isActive
                          ? accountType === 'business' 
                            ? "text-[var(--cashlap-blue)] bg-blue-100 border border-blue-200"
                            : "text-[var(--cashlap-green)] bg-green-100 border border-green-200"
                      : "text-gray-600 hover:text-gray-800 hover:bg-gray-100 active:bg-gray-200"
                      }`}
                      style={{ 
                        minHeight: '64px',
                        minWidth: '64px',
                        WebkitTapHighlightColor: 'transparent'
                      }}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      <span className="text-xs sm:text-sm font-medium truncate w-full text-center leading-tight">{item.title}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>

          <CashChatbot />
        </div>
      )}
    </>
  );
}
