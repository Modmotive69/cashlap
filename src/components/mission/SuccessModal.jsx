import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Check, ArrowRight, Hourglass, Coins, Star } from 'lucide-react';

export default function SuccessModal({ success, onClose }) {
  const { approved, message, mission } = success;
  const businessName = mission.business_name || 'the business';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-lg w-full max-w-sm overflow-hidden"
      >
        <div className="p-6 text-center">
          
          {approved ? (
            // Auto-Approved View
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Mission Complete! 🎉</h2>
              <p className="text-gray-600 mb-6">
                Great job completing the "{mission.title}" mission.
              </p>

              <div className="space-y-3 text-left">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Coins className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-semibold text-gray-900">Cash Earned</p>
                      <p className="text-sm text-gray-600">Added to your wallet</p>
                    </div>
                  </div>
                  <p className="font-bold text-green-600 text-lg">
                    +${(mission.final_reward_amount || mission.reward_amount || 0).toFixed(2)}
                  </p>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Star className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-semibold text-gray-900">Experience</p>
                      <p className="text-sm text-gray-600">Level progress</p>
                    </div>
                  </div>
                  <p className="font-bold text-blue-600 text-lg">+10 XP</p>
                </div>
              </div>
            </>
          ) : (
            // Manual Review View
            <>
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Hourglass className="w-8 h-8 text-amber-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Submission Received!</h2>
              <p className="text-gray-600 mb-6 px-4">
                {message || "Your submission is pending review. The business will approve your post, and you'll receive your reward once it's confirmed!"}
              </p>
            </>
          )}

          <Button onClick={onClose} className="w-full mt-6 bg-blue-600 hover:bg-blue-700">
            Continue to Dashboard
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </motion.div>
    </div>
  );
}