import './App.css'
import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import * as Sentry from '@sentry/react'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { lazy } from 'react'
const VisualEditAgent = import.meta.env.VITE_ENABLE_VISUAL_EDIT === 'true'
  ? lazy(() => import('@/lib/VisualEditAgent'))
  : () => null
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Suspense fallback={
                <div className="flex items-center justify-center min-h-[60vh]">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              }>
                <Page />
              </Suspense>
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {
  return (
    <Sentry.ErrorBoundary fallback={
      <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Something went wrong</h2>
        <p className="text-gray-500 mb-4">An unexpected error occurred. Our team has been notified.</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-black text-white rounded-lg text-sm">Reload App</button>
      </div>
    }>
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <VisualEditAgent />
      </QueryClientProvider>
    </AuthProvider>
    </Sentry.ErrorBoundary>
  )
}

export default App
