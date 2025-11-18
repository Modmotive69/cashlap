import { useEffect, useState } from 'react';
import { User } from '@/entities/User';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

export default function AuthCallback() {
  const [status, setStatus] = useState('processing'); // 'processing', 'success', 'error'
  const [message, setMessage] = useState('Completing your login...');

  useEffect(() => {
    handleAuthCallback();
  }, []);

  const handleAuthCallback = async () => {
    try {
      // Allow time for Base44 to process the authentication
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify the user is now authenticated
      const user = await User.me();
      
      if (!user) {
        throw new Error('Authentication verification failed');
      }

      // Ensure verification status is updated
      await User.updateMyUserData({
        last_login: new Date().toISOString(),
        last_verification_check: new Date().toISOString()
      });

      setStatus('success');
      setMessage('Login successful! Redirecting...');

      // Redirect based on onboarding status
      setTimeout(() => {
        if (user.onboarding_completed) {
          window.location.href = createPageUrl('Dashboard');
        } else {
          window.location.href = createPageUrl('Onboarding');
        }
      }, 1500);

    } catch (error) {
      console.error('Auth callback error:', error);
      setStatus('error');
      setMessage('Login verification failed. Please try again.');
      
      // Redirect to onboarding after delay
      setTimeout(() => {
        window.location.href = createPageUrl('Onboarding');
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          {status === 'processing' && (
            <>
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-[var(--cashlap-green)] animate-spin" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Verifying Your Account</h2>
              <p className="text-gray-600">{message}</p>
            </>
          )}
          
          {status === 'success' && (
            <>
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Verification Complete!</h2>
              <p className="text-gray-600">{message}</p>
            </>
          )}
          
          {status === 'error' && (
            <>
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Verification Failed</h2>
              <p className="text-gray-600">{message}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}