import Dashboard from './pages/Dashboard';
import Explore from './pages/Explore';
import Profile from './pages/Profile';
import Analytics from './pages/Analytics';
import BusinessAnalytics from './pages/BusinessAnalytics';
import Onboarding from './pages/Onboarding';
import CameraCapture from './pages/CameraCapture';
import CampaignManager from './pages/CampaignManager';
import CampaignAnalytics from './pages/CampaignAnalytics';
import Security from './pages/Security';
import AuthCallback from './pages/AuthCallback';
import MissionSubmission from './pages/MissionSubmission';
import SubmissionReview from './pages/SubmissionReview';
import Campaigns from './pages/Campaigns';
import PayoutSetup from './pages/PayoutSetup';
import BusinessFunding from './pages/BusinessFunding';
import PaymentSuccess from './pages/PaymentSuccess';
import CampaignQR from './pages/CampaignQR';
import SignIn from './pages/SignIn';
import TikTokRedirectHandler from './pages/TikTokRedirectHandler';
import TikTokComplete from './pages/TikTokComplete';
import ARMap from './pages/ARMap';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Explore": Explore,
    "Profile": Profile,
    "Analytics": Analytics,
    "BusinessAnalytics": BusinessAnalytics,
    "Onboarding": Onboarding,
    "CameraCapture": CameraCapture,
    "CampaignManager": CampaignManager,
    "CampaignAnalytics": CampaignAnalytics,
    "Security": Security,
    "AuthCallback": AuthCallback,
    "MissionSubmission": MissionSubmission,
    "SubmissionReview": SubmissionReview,
    "Campaigns": Campaigns,
    "PayoutSetup": PayoutSetup,
    "BusinessFunding": BusinessFunding,
    "PaymentSuccess": PaymentSuccess,
    "CampaignQR": CampaignQR,
    "SignIn": SignIn,
    "TikTokRedirectHandler": TikTokRedirectHandler,
    "TikTokComplete": TikTokComplete,
    "ARMap": ARMap,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};