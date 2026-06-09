import { lazy } from 'react';
import __Layout from './Layout.jsx';

// Lazy-load all pages for code splitting — reduces initial bundle by ~60-70%
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Explore = lazy(() => import('./pages/Explore'));
const Profile = lazy(() => import('./pages/Profile'));
const Analytics = lazy(() => import('./pages/Analytics'));
const BusinessAnalytics = lazy(() => import('./pages/BusinessAnalytics'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const CameraCapture = lazy(() => import('./pages/CameraCapture'));
const CampaignManager = lazy(() => import('./pages/CampaignManager'));
const CampaignAnalytics = lazy(() => import('./pages/CampaignAnalytics'));
const Security = lazy(() => import('./pages/Security'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const MissionSubmission = lazy(() => import('./pages/MissionSubmission'));
const SubmissionReview = lazy(() => import('./pages/SubmissionReview'));
const Campaigns = lazy(() => import('./pages/Campaigns'));
const PayoutSetup = lazy(() => import('./pages/PayoutSetup'));
const BusinessFunding = lazy(() => import('./pages/BusinessFunding'));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'));
const CampaignQR = lazy(() => import('./pages/CampaignQR'));
const SignIn = lazy(() => import('./pages/SignIn'));
const TikTokRedirectHandler = lazy(() => import('./pages/TikTokRedirectHandler'));
const TikTokComplete = lazy(() => import('./pages/TikTokComplete'));

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
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};
