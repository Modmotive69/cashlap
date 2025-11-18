import { Input } from '@/components/ui/input';
import { Users, TrendingUp, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function StepBusinessBaseline({ businessData, onUpdate }) {
  const handleChange = (field, value) => {
    const numericValue = value.replace(/[^0-9]/g, '');
    onUpdate({ ...businessData, [field]: numericValue });
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-gray-600 leading-relaxed">
          Help us understand your current performance so we can track the impact of your campaigns.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-3xl p-8 border border-green-100"
      >
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Users className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Daily Customer Count</h3>
          <p className="text-gray-600 text-sm">How many customers do you typically serve per day?</p>
        </div>

        <div className="relative">
          <Input
            type="number"
            placeholder="e.g., 50"
            value={businessData.average_daily_traffic || ''}
            onChange={(e) => handleChange('average_daily_traffic', e.target.value)}
            className="text-center text-3xl font-bold h-20 rounded-2xl border-2 border-green-200 focus:border-green-400 focus:ring-4 focus:ring-green-100 transition-all duration-200 bg-white/80"
            min="0"
            inputMode="numeric"
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <TrendingUp className="w-6 h-6 text-green-500" />
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="grid grid-cols-2 gap-4"
      >
        <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl text-center">
          <BarChart3 className="w-8 h-8 text-blue-600 mx-auto mb-2" />
          <p className="text-blue-800 font-medium text-sm">Track Growth</p>
          <p className="text-blue-600 text-xs">Monitor increases</p>
        </div>
        <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl text-center">
          <TrendingUp className="w-8 h-8 text-purple-600 mx-auto mb-2" />
          <p className="text-purple-800 font-medium text-sm">Measure Impact</p>
          <p className="text-purple-600 text-xs">See results</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="p-4 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl border border-amber-100"
      >
        <p className="text-amber-700 text-sm font-medium text-center leading-relaxed">
          📈 This baseline helps you see how CashLap campaigns boost your customer traffic and engagement.
        </p>
      </motion.div>
    </div>
  );
}