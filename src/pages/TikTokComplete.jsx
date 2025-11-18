import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { completeTikTokOAuth } from '@/functions/completeTikTokOAuth';
import { Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { createPageUrl } from '@/utils';

export default function TikTokComplete() {
  const location = useLocation();
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState('');

  useEffect(() => {
    const processAuth = async () => {
      try {
        const params = new URLSearchParams(location.search);
        const code = params.get('code');
        const state = params.get('state');
        const errorParam = params.get('error');

        console.log('TikTok Complete - Received params:', { 
          code: !!code, 
          state: !!state, 
          error: errorParam 
        });

        if (errorParam) {
          setError(`TikTok authentication failed: ${errorParam}`);
          setStatus('error');
          setTimeout(() => {
            window.location.href = createPageUrl('Profile?tiktok_error=' + encodeURIComponent(errorParam));
          }, 3000);
          return;
        }

        if (!code || !state) {
          setError('Invalid callback parameters from TikTok.');
          setStatus('error');
          setTimeout(() => {
            window.location.href = createPageUrl('Profile?tiktok_error=invalid_params');
          }, 3000);
          return;
        }

        console.log('Calling completeTikTokOAuth...');
        const response = await completeTikTokOAuth({ code, state });
        console.log('completeTikTokOAuth response:', response);
        
        if (response.data?.success) {
          setStatus('success');
          setTimeout(() => {
            window.location.href = createPageUrl('Profile?tiktok_success=true');
          }, 2000);
        } else {
          throw new Error(response.data?.error || 'Failed to complete TikTok authentication.');
        }
      } catch (e) {
        console.error("Error in TikTok complete:", e);
        setError(e.message || 'An unknown error occurred.');
        setStatus('error');
        setTimeout(() => {
          window.location.href = createPageUrl('Profile?tiktok_error=' + encodeURIComponent(e.message));
        }, 3000);
      }
    };

    processAuth();
  }, [location]);

  const statusContent = {
    processing: {
      icon: <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />,
      title: 'Connecting TikTok...',
      message: 'Securely linking your TikTok account. Please wait.',
    },
    success: {
      icon: <CheckCircle className="w-12 h-12 text-green-500" />,
      title: 'Success!',
      message: 'Your TikTok account has been linked successfully! Redirecting...',
    },
    error: {
      icon: <AlertTriangle className="w-12 h-12 text-red-500" />,
      title: 'Connection Failed',
      message: error,
    },
  };

  const currentStatus = statusContent[status];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm text-center bg-white p-8 rounded-xl shadow-lg">
        <div className="mx-auto mb-4">{currentStatus.icon}</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">{currentStatus.title}</h1>
        <p className="text-gray-600">{currentStatus.message}</p>
        {status === 'error' && (
          <p className="text-xs text-gray-500 mt-4">Redirecting to profile page...</p>
        )}
      </div>
    </div>
  );
}