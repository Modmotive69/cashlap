import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { finalizeTikTokAuth } from '@/functions/finalizeTikTokAuth';
import { Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { createPageUrl } from '@/utils';

export default function TikTokRedirectHandler() {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState('');

  useEffect(() => {
    const processAuth = async () => {
      const params = new URLSearchParams(location.search);
      const code = params.get('code');
      const state = params.get('state');
      const errorParam = params.get('error');

      if (errorParam) {
        setError(`TikTok authentication failed: ${errorParam}`);
        setStatus('error');
        setTimeout(() => navigate(createPageUrl('Profile')), 5000);
        return;
      }

      if (!code || !state) {
        setError('Invalid callback parameters from TikTok.');
        setStatus('error');
        setTimeout(() => navigate(createPageUrl('Profile')), 5000);
        return;
      }

      try {
        const response = await finalizeTikTokAuth({ code, state });
        if (response.data?.success) {
          setStatus('success');
          setTimeout(() => {
            window.location.href = createPageUrl('Profile?tiktok_success=true');
          }, 2000);
        } else {
          throw new Error(response.data?.error || 'Failed to finalize TikTok connection.');
        }
      } catch (e) {
        console.error("Error finalizing TikTok auth:", e);
        setError(e.message || 'An unknown error occurred.');
        setStatus('error');
        setTimeout(() => navigate(createPageUrl('Profile')), 5000);
      }
    };

    processAuth();
  }, [location, navigate]);

  const statusContent = {
    processing: {
      icon: <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />,
      title: 'Finalizing Connection...',
      message: 'Securely connecting your TikTok account. Please wait.',
    },
    success: {
      icon: <CheckCircle className="w-12 h-12 text-green-500" />,
      title: 'Success!',
      message: 'Your TikTok account has been linked. Redirecting...',
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
      </div>
    </div>
  );
}