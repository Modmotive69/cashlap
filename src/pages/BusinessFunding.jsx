import { useState, useEffect } from 'react';
import { User } from '@/entities/all';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, DollarSign, ArrowLeft, Wallet, AlertTriangle } from 'lucide-react';
import { createStripeCheckoutSession } from '@/functions/createStripeCheckoutSession';
import AuthGuard from '@/components/auth/AuthGuard';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';

function BusinessFundingContent() {
  const [amount, setAmount] = useState('50');
  const [customAmount, setCustomAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);
      } catch (err) {
        setError("Failed to load user data.");
      }
    };
    fetchUser();

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('cancelled')) {
      setError("Payment was cancelled. Please try again.");
    }
  }, []);

  const handleAddFunds = async () => {
    const finalAmount = parseFloat(customAmount || amount);
    if (isNaN(finalAmount) || finalAmount < 5) {
      setError("Minimum funding amount is $5.00.");
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await createStripeCheckoutSession({ amount: finalAmount });
      if (response.data?.success && response.data?.checkout_url) {
        window.location.href = response.data.checkout_url;
      } else {
        throw new Error(response.data?.error || "Failed to create payment session.");
      }
    } catch (err) {
      console.error("Funding error:", err);
      setError(err.message || "An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  const handleAmountSelection = (selectedAmount) => {
    setAmount(selectedAmount);
    setCustomAmount('');
    setError('');
  }

  const handleCustomAmountChange = (e) => {
    const value = e.target.value;
    setCustomAmount(value);
    setAmount(''); // Deselect preset amount
    if (parseFloat(value) < 5) {
      setError("Minimum amount is $5.00.");
    } else {
      setError('');
    }
  }

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto">
        <Link to={createPageUrl('Dashboard')} className="flex items-center text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Dashboard
        </Link>

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Wallet className="w-6 h-6 text-[var(--cashlap-blue)]" />
                    <span>Business Funding</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="p-4 bg-blue-50 rounded-lg text-center">
                    <p className="text-sm text-blue-700">Current Balance</p>
                    <p className="text-3xl font-bold text-blue-900">${(user?.business_balance || 0).toFixed(2)}</p>
                </div>
                
                <div>
                    <label className="block text-sm font-medium mb-2">Select Amount</label>
                    <div className="grid grid-cols-3 gap-2">
                        {['25', '50', '100'].map(val => (
                            <Button key={val} variant={amount === val ? 'default' : 'outline'} onClick={() => handleAmountSelection(val)} className={amount === val ? 'bg-[var(--cashlap-blue)]' : ''}>
                                ${val}
                            </Button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2">Or Enter Custom Amount</label>
                    <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input 
                            type="number" 
                            placeholder="e.g., 75" 
                            value={customAmount}
                            onChange={handleCustomAmountChange}
                            className="pl-10 text-lg"
                            min="5"
                        />
                    </div>
                </div>

                {error && (
                    <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        {error}
                    </div>
                )}

                <Button onClick={handleAddFunds} disabled={loading || (!customAmount && !amount)} className="w-full bg-[var(--cashlap-blue)] hover:opacity-90 text-white font-bold py-3 text-base">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : `Add $${customAmount || amount} to Balance`}
                </Button>

                 <p className="text-xs text-gray-500 text-center">You will be redirected to Stripe to complete your payment securely.</p>
            </CardContent>
        </Card>
    </div>
  );
}

export default function BusinessFunding() {
    return (
        <AuthGuard requireAuth={true} requiredAccountType="business" fallbackUrl="Dashboard">
            <BusinessFundingContent />
        </AuthGuard>
    );
}