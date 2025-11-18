import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { PartyPopper } from 'lucide-react';

export default function WithdrawSuccessPanel({ amount, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="p-6 flex flex-col items-center justify-center text-center"
    >
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 border-4 border-green-200">
        <PartyPopper className="w-8 h-8 text-[var(--cashlap-green)]" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Success!</h2>
      <p className="text-gray-600 mb-4">
        Your withdrawal of <span className="font-bold text-gray-800">${amount.toFixed(2)}</span> has been processed.
      </p>
      <p className="text-sm text-gray-500 mb-6">
        Funds should appear in your bank account within 2-3 business days.
      </p>
      <Button
        onClick={onClose}
        className="w-full bg-[var(--cashlap-green)] hover:opacity-90 text-white font-bold py-3 rounded-xl text-base"
      >
        Done
      </Button>
    </motion.div>
  );
}