import { useState, useEffect } from 'react';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { User } from '@/entities/User';

export default function ARMap() {
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const setupARAuth = async () => {
      try {
        // Get the current user
        const user = await User.me();
        
        if (!user || !user.id) {
          setAuthError('Please log in to access AR features');
          return;
        }

        // Store user data for 8th Wall to access
        const authData = {
          user_id: user.id,
          email: user.email,
          display_name: user.display_name || user.full_name,
          account_type: user.account_type,
          timestamp: Date.now()
        };

        // Store in localStorage for 8th Wall iframe to read
        localStorage.setItem('cashlap_ar_auth', JSON.stringify(authData));
        localStorage.setItem('cashlap_user_id', user.id);
        
        // Get the authentication headers/token that base44 uses
        // This will allow 8th Wall to make authenticated requests
        const authHeaders = {
          'Authorization': document.cookie.split('; ')
            .find(row => row.startsWith('sb-access-token='))
            ?.split('=')[1] || '',
        };
        
        if (authHeaders.Authorization) {
          localStorage.setItem('cashlap_auth_token', authHeaders.Authorization);
        }

        console.log('[ARMap] Auth setup complete for user:', user.id);
        
        // Send message to iframe once it loads
        setTimeout(() => {
          const iframe = document.querySelector('iframe');
          if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
              type: 'CASHLAP_AUTH',
              data: authData
            }, '*');
            console.log('[ARMap] Auth data sent to 8th Wall iframe');
          }
        }, 2000);

      } catch (error) {
        console.error('[ARMap] Auth setup failed:', error);
        setAuthError('Authentication failed. Please log in again.');
      }
    };

    setupARAuth();

    // Listen for messages from the 8th Wall iframe
    const handleMessage = (event) => {
      // Security: Verify origin if needed
      // if (event.origin !== 'https://ziosdevllc.8thwall.app') return;
      
      if (event.data.type === 'AR_READY') {
        console.log('[ARMap] 8th Wall AR is ready');
        const authData = localStorage.getItem('cashlap_ar_auth');
        if (authData && event.source) {
          event.source.postMessage({
            type: 'CASHLAP_AUTH',
            data: JSON.parse(authData)
          }, '*');
        }
      } else if (event.data.type === 'AR_ERROR') {
        console.error('[ARMap] AR Error:', event.data.error);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  if (authError) {
    return (
      <div className="flex flex-col h-[100dvh] bg-gray-900 items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 max-w-md text-center">
          <Globe className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-6">{authError}</p>
          <a href={createPageUrl("SignIn")}>
            <Button className="w-full bg-[var(--cashlap-green)] hover:opacity-90">
              Log In to Continue
            </Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-900 relative">
      {/* Floating Back Button */}
      <div className="absolute top-4 left-4 z-30" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <a href={createPageUrl("Explore")}>
          <Button 
            variant="outline" 
            size="icon" 
            className="bg-black/60 border-white/20 text-white hover:bg-black/80 backdrop-blur-sm shadow-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </a>
      </div>

      {/* Loading Indicator for AR Experience */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white z-20"
          >
            <div className="w-16 h-16 bg-[var(--cashlap-green)] rounded-full flex items-center justify-center mb-6">
              <Globe className="w-8 h-8 text-white" />
            </div>
            <Loader2 className="w-10 h-10 animate-spin text-[var(--cashlap-green)] mb-4" />
            <h2 className="text-xl font-bold mb-2">Entering AR World</h2>
            <p className="text-gray-400 text-center max-w-xs">
              Loading your augmented reality experience...
            </p>
            <p className="text-sm text-gray-500 mt-4 text-center">
              Please allow camera access when prompted
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 8th Wall Iframe */}
      <iframe
        src="https://ziosdevllc.8thwall.app/cashlaplens/"
        onLoad={handleIframeLoad}
        style={{ 
          flex: 1, 
          width: '100%', 
          border: 'none', 
          display: isLoading ? 'none' : 'block' 
        }}
        allow="camera; microphone; geolocation; accelerometer; gyroscope; magnetometer; xr-spatial-tracking; fullscreen"
        allowFullScreen
        title="CashLap AR Map Experience"
      />
    </div>
  );
}