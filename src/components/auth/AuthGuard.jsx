
import { useState, useEffect } from 'react';
import { User } from '@/entities/User';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, AlertTriangle, Home, LogIn, Loader2 } from 'lucide-react';
import { createPageUrl } from '@/utils';

const AuthGuard = ({
  children,
  requiredAccountType = null,
  requireAuth = true,
  requireBusinessId = false,
  allowedRoles = null,
  fallbackUrl = 'Dashboard'
}) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Enhanced auth check with mobile browser compatibility
  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);
      setAuthError(null);
      
      try {
        // Add a small delay for mobile browsers to ensure session is ready
        if (/Mobi|Android/i.test(navigator.userAgent)) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        const currentUser = await User.me();
        
        // Validate user object has required fields
        if (!currentUser || !currentUser.id || !currentUser.email) {
          throw new Error('Invalid user session - missing required fields');
        }
        
        setUser(currentUser);
        console.log('[AuthGuard] User authenticated successfully:', {
          id: currentUser.id,
          email: currentUser.email,
          account_type: currentUser.account_type,
          business_id: currentUser.business_id
        });
        
      } catch (error) {
        console.error('[AuthGuard] Auth check failed:', error);
        
        // Enhanced error handling for mobile
        let errorMessage = 'Authentication failed';
        if (error.message?.includes('session') || error.status === 401) {
          errorMessage = 'Session expired. Please log in again.';
        } else if (error.message?.includes('network') || error.name === 'NetworkError') {
          errorMessage = 'Network error. Please check your connection and try again.';
        }
        
        setAuthError(errorMessage);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []); // No dependencies to prevent loops

  // Enhanced loading state for mobile
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <Loader2 className="w-12 h-12 mx-auto mb-4 text-[var(--cashlap-green)] animate-spin" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Verifying Access</h3>
            <p className="text-gray-600">Checking your permissions...</p>
            {/Mobi|Android/i.test(navigator.userAgent) && (
              <p className="text-xs text-gray-500 mt-2">Mobile device detected - optimizing session...</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Authentication required but user not authenticated
  if (requireAuth && (!user || authError)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-red-200">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Authentication Required</h2>
            <p className="text-gray-600 mb-4">
              {authError || 'You must be logged in to access this page.'}
            </p>
            <div className="space-y-2">
              <Button
                onClick={() => {
                  window.location.href = createPageUrl('SignIn');
                }}
                className="w-full bg-[var(--cashlap-green)] hover:opacity-90"
              >
                <LogIn className="w-4 h-4 mr-2" />
                Sign In
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.href = createPageUrl('Dashboard')}
                className="w-full"
              >
                <Home className="w-4 h-4 mr-2" />
                Go to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check account type authorization
  if (requiredAccountType && user?.account_type !== requiredAccountType) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-orange-200">
          <CardContent className="p-6 text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-orange-500" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Access Restricted</h2>
            <p className="text-gray-600 mb-4">
              This page is only available to {requiredAccountType} accounts.
              Your account type is: {user?.account_type || 'unknown'}.
            </p>
            <Button
              onClick={() => window.location.href = createPageUrl(fallbackUrl)}
              className="w-full bg-[var(--cashlap-blue)] hover:opacity-90"
            >
              <Home className="w-4 h-4 mr-2" />
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check role-based authorization
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-red-200">
          <CardContent className="p-6 text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Insufficient Permissions</h2>
            <p className="text-gray-600 mb-4">
              You don't have the required permissions to access this page.
              Required roles: {allowedRoles.join(', ')}. Your role: {user?.role || 'user'}.
            </p>
            <Button
              onClick={() => window.location.href = createPageUrl(fallbackUrl)}
              className="w-full bg-[var(--cashlap-blue)] hover:opacity-90"
            >
              <Home className="w-4 h-4 mr-2" />
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check business ID requirement with enhanced validation
  if (requireBusinessId && !user?.business_id) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-yellow-200">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Business Setup Required</h2>
            <p className="text-gray-600 mb-4">
              You need to complete your business profile setup to access this page.
            </p>
            <div className="space-y-2">
              <Button
                onClick={() => window.location.href = createPageUrl('Profile')}
                className="w-full bg-[var(--cashlap-blue)] hover:opacity-90"
              >
                Complete Profile Setup
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.href = createPageUrl('Dashboard')}
                className="w-full"
              >
                <Home className="w-4 h-4 mr-2" />
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // All authorization checks passed
  return children;
};

export default AuthGuard;
