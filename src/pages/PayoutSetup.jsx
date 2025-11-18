import { useState, useEffect } from 'react';
import { User } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createStripeConnectAccount } from '@/functions/createStripeConnectAccount';
import { CheckCircle, AlertTriangle, CreditCard, ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import AuthGuard from '@/components/auth/AuthGuard';

function PayoutSetupContent() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadUser();
    
    // Handle URL params from Stripe redirects
    const urlParams = new URLSearchParams(window.location.search);
    const refresh = urlParams.get('refresh');
    const success = urlParams.get('success');
    
    if (refresh === 'true') {
      setError('Setup incomplete. Please complete the verification process.');
    }
    if (success === 'true') {
      setError(null);
      setTimeout(() => {
        window.location.href = '/Dashboard';
      }, 2000);
    }
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);
    } catch (err) {
      console.error('Error loading user:', err);
      setError('Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupPayout = async () => {
    setCreating(true);
    setError(null);
    
    try {
      const response = await createStripeConnectAccount();
      
      if (response.data?.success && response.data?.onboarding_url) {
        // Redirect to Stripe onboarding
        window.location.href = response.data.onboarding_url;
      } else {
        throw new Error(response.data?.error || 'Failed to create account');
      }
    } catch (err) {
      console.error('Error creating Stripe account:', err);
      setError(err.message || 'Failed to set up payout account');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--cashlap-green)]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-6">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <h3 className="text-lg font-semibold mb-2">Access Error</h3>
            <p className="text-gray-600">Unable to load your account information.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasStripeAccount = !!user.stripe_player_account_id;
  const payoutEnabled = user.player_payout_enabled;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            Set Up Bank Account
          </h1>
          <p className="text-gray-600">
            Connect your bank account to receive payouts from your CashLap earnings
          </p>
        </motion.div>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Payout Account Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Account Connected</span>
              {hasStripeAccount ? (
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="text-gray-600">
                  Not Connected
                </Badge>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-700">Payouts Enabled</span>
              {payoutEnabled ? (
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
              ) : (
                <Badge variant="outline" className="text-gray-600">
                  {hasStripeAccount ? 'Pending Verification' : 'Not Set Up'}
                </Badge>
              )}
            </div>

            <div className="pt-4 border-t">
              <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <h4 className="font-semibold text-blue-900 mb-2">How it works:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Connect your bank account securely through Stripe</li>
                  <li>• Complete a quick verification process</li>
                  <li>• Receive payouts within 2-3 business days</li>
                  <li>• No fees for standard bank transfers</li>
                </ul>
              </div>

              {!hasStripeAccount ? (
                <Button
                  onClick={handleSetupPayout}
                  disabled={creating}
                  className="w-full bg-[var(--cashlap-green)] hover:opacity-90 text-white"
                  size="lg"
                >
                  {creating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4 mr-2" />
                  )}
                  {creating ? 'Setting up...' : 'Connect Bank Account'}
                </Button>
              ) : !payoutEnabled ? (
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-3">
                    Your account is connected but needs verification to enable payouts.
                  </p>
                  <Button
                    onClick={handleSetupPayout}
                    variant="outline"
                    className="w-full"
                  >
                    Complete Verification
                  </Button>
                </div>
              ) : (
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-600" />
                  <p className="font-semibold text-green-900">All Set!</p>
                  <p className="text-sm text-green-700">
                    Your bank account is connected and verified. You can now withdraw your earnings.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button
            variant="ghost"
            onClick={() => window.location.href = '/Dashboard'}
            className="text-gray-600"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function PayoutSetup() {
  return (
    <AuthGuard requireAuth={true} fallbackUrl="Onboarding">
      <PayoutSetupContent />
    </AuthGuard>
  );
}