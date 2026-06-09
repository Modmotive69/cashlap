
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, Loader2, AlertTriangle, Banknote } from 'lucide-react';
import NumericKeypad from '@/components/keypad/NumericKeypad';
import { processStripeWithdrawal } from "@/functions/processStripeWithdrawal";
import { createPageUrl } from '@/utils';
import WithdrawSuccessPanel from './WithdrawSuccessPanel';
import { analytics } from '@/lib/analytics';

export default function WithdrawModal({ user, onClose, onSuccess }) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [showSuccessPanel, setShowSuccessPanel] = useState(false);
  const [withdrawnAmount, setWithdrawnAmount] = useState(0);
  const [newBalance, setNewBalance] = useState(null);

  const availableBalance = user?.total_earnings || 0;

  const handleKeyPress = (key) => {
    setError(null);
    setNeedsOnboarding(false);
    
    if (isProcessing) return;

    if (key === 'del') {
      setAmount(prev => prev.slice(0, -1));
    } else if (key === '.' && amount.includes('.')) {
      // Do nothing, only one decimal point allowed
    } else if (amount.includes('.') && amount.split('.')[1].length >= 2) {
      // Do nothing, only two decimal places allowed
    } else {
      const newAmount = amount + key;
      const newAmountValue = parseFloat(newAmount);
      if (newAmountValue > availableBalance) {
        setError('Amount cannot exceed available balance.');
        setAmount(availableBalance.toFixed(2).toString());
      } else {
        setAmount(newAmount);
      }
    }
  };

  const handleSetupPayout = () => {
    window.location.href = createPageUrl('PayoutSetup');
  };

  const handleWithdrawal = async (e) => {
    e.preventDefault();

    // Parse the amount string to a number
    const withdrawAmount = parseFloat(amount);
    
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    if (withdrawAmount > availableBalance) {
      setError('Withdrawal amount exceeds available balance.');
      return;
    }
    if (withdrawAmount < 1) {
      setError('Minimum withdrawal amount is $1.00.');
      return;
    }

    analytics.withdrawInitiated(withdrawAmount);
    setIsProcessing(true);
    setError(null);
    setNeedsOnboarding(false);
    
    try {
      const result = await processStripeWithdrawal({ amount: withdrawAmount });

      if (result?.data?.success) {
        analytics.withdrawSuccess(withdrawAmount);
        setWithdrawnAmount(withdrawAmount);
        setNewBalance(result.data.newBalance);
        setShowSuccessPanel(true);
      } else {
        if (result?.data?.needs_onboarding) {
            setNeedsOnboarding(true);
            setError(result.data.error || 'Please set up your payout account first.');
        } else {
            throw new Error(result?.data?.error || 'Withdrawal failed on server.');
        }
      }
    } catch (error) {
      console.error('Withdrawal processing failed:', error);
      if (error.response?.data?.needs_onboarding) {
        setNeedsOnboarding(true);
        setError(error.response.data.error || 'Please set up your payout account first.');
      } else {
        setError(error.response?.data?.error || error.message || 'Withdrawal processing failed. Please try again.');
      }
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleSuccessPanelClose = () => {
    if (newBalance !== null) {
      onSuccess(newBalance);
    }
    onClose();
  };

  const displayAmount = amount ? `$${amount}` : '$0.00';
  const buttonDisplayAmount = amount ? parseFloat(amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '$0.00';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="bg-white w-full max-w-xs mx-auto rounded-2xl shadow-xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {showSuccessPanel ? (
          <WithdrawSuccessPanel
            amount={withdrawnAmount}
            onClose={handleSuccessPanelClose}
          />
        ) : (
          <>
            {/* Header */}
            <div className="flex-shrink-0 p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-800">Withdraw to Bank</h2>
                <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full text-gray-500 hover:bg-gray-100 w-8 h-8">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
              <div className="text-center">
                <p className="text-xs text-gray-500">Available Balance</p>
                <p className="text-lg font-bold text-gray-800">${availableBalance.toFixed(2)}</p>
              </div>
              
              <div className="text-center my-1">
                <p className="text-4xl font-light tracking-tight text-gray-900">
                  {displayAmount}
                </p>
              </div>
              
              <div className="min-h-[18px] flex items-center justify-center">
                {error && (
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-red-500" />
                    <p className="text-red-500 text-xs text-center font-medium">{error}</p>
                  </div>
                )}
              </div>

              {needsOnboarding ? (
                <div className="space-y-3">
                  <div className="bg-blue-50 p-3 rounded-lg text-center">
                    <Banknote className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                    <p className="text-sm text-blue-800 font-medium">Connect Your Bank Account</p>
                    <p className="text-xs text-blue-700 mt-1">
                      Set up secure payouts to receive your earnings
                    </p>
                  </div>
                  <Button
                    onClick={handleSetupPayout}
                    className="w-full bg-[var(--cashlap-blue)] hover:opacity-90 text-white font-bold py-3 rounded-xl text-base"
                  >
                    Set Up Payout Account
                  </Button>
                </div>
              ) : (
                <>
                  <NumericKeypad onKeyPress={handleKeyPress} />
                  
                  <Button
                    onClick={handleWithdrawal}
                    disabled={isProcessing || !amount || parseFloat(amount) <= 0}
                    className="w-full bg-[var(--cashlap-green)] hover:opacity-90 text-white font-bold py-3 rounded-xl text-base transition-all shadow-md shadow-[var(--cashlap-green)]/20"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    {isProcessing ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      `Withdraw ${buttonDisplayAmount}`
                    )}
                  </Button>
                </>
              )}

              {!needsOnboarding && (
                <div className="text-center">
                  <p className="text-xs text-gray-500">
                    Funds will arrive in 2-3 business days
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
