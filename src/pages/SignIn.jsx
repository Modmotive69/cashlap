
import { useState, useEffect } from 'react';
import { User } from '@/entities/User';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';
import { Users, Briefcase, Loader2 } from 'lucide-react';

export default function SignIn() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuthStatus = async () => {
      setLoading(true);
      try {
        const user = await User.me();
        // If user is already authenticated, redirect to Dashboard
        if (user && user.id) {
          window.location.href = createPageUrl('Dashboard');
          return;
        }
      } catch (e) {
        // User is not authenticated, which is expected on this page.
        console.log('User not authenticated - showing sign in options');
      } finally {
        setLoading(false);
      }
    };
    checkAuthStatus();
  }, []);

  const handleLogin = async (type) => {
    try {
      console.log(`User selected ${type} account type`);
      // Store the intended account type before redirecting
      localStorage.setItem('intended_account_type', type);
      
      // Since the app is now public, redirect to onboarding which will handle the login
      window.location.href = createPageUrl('Onboarding');
    } catch (error) {
      console.error("Login initiation failed:", error);
      setError("Login initiation failed. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-[var(--cashlap-green)] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center"
      >
        <div className="w-20 h-20 mx-auto mb-4">
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/35bcc7111_ffb153679_Group40.png"
            alt="CashLap Logo"
            className="w-full h-full object-contain"
          />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to CashLap</h1>
        <p className="text-gray-600 mb-8">Choose your account type to get started.</p>
        
        <div className="space-y-4 max-w-xs mx-auto">
          <Button
            onClick={() => handleLogin('player')}
            className="w-full bg-[var(--cashlap-green)] hover:bg-[var(--cashlap-green)]/90 text-white flex items-center justify-center gap-2"
            size="lg"
          >
            <Users className="w-5 h-5" />
            <span>Join as a Player</span>
          </Button>
          <Button
            onClick={() => handleLogin('business')}
            className="w-full bg-[var(--cashlap-blue)] hover:bg-[var(--cashlap-blue)]/90 text-white flex items-center justify-center gap-2"
            size="lg"
          >
            <Briefcase className="w-5 h-5" />
            <span>Join as a Business</span>
          </Button>
        </div>

        <div className="mt-6 text-sm text-gray-500">
          <p>Already have an account? Selecting your account type will take you to sign in.</p>
        </div>

        {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
      </motion.div>
    </div>
  );
}
