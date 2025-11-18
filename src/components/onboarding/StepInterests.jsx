import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const interestOptions = [
  { value: "restaurant", label: "Restaurant", icon: "🍽️", color: "from-orange-400 to-red-500" },
  { value: "cafe", label: "Cafe", icon: "☕", color: "from-amber-400 to-orange-500" },
  { value: "retail", label: "Retail", icon: "🛍️", color: "from-pink-400 to-rose-500" },
  { value: "fitness", label: "Fitness", icon: "💪", color: "from-emerald-400 to-green-500" },
  { value: "beauty", label: "Beauty", icon: "💄", color: "from-purple-400 to-pink-500" },
  { value: "entertainment", label: "Entertainment", icon: "🎬", color: "from-blue-400 to-indigo-500" },
  { value: "services", label: "Services", icon: "🔧", color: "from-gray-400 to-slate-500" },
  { value: "health", label: "Health", icon: "🏥", color: "from-teal-400 to-cyan-500" }
];

export default function StepInterests({ userData, onUpdate }) {
  const [selected, setSelected] = useState(userData.favorite_categories || []);

  useEffect(() => {
    onUpdate({ favorite_categories: selected });
  }, [selected, onUpdate]);

  const toggleSelection = (value) => {
    setSelected(prev =>
      prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value]
    );
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-gray-600 leading-relaxed">
          Select the categories that interest you most. This helps us recommend the perfect opportunities for you.
        </p>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {interestOptions.map((interest, index) => (
          <motion.div
            key={interest.value}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.4 }}
            onClick={() => toggleSelection(interest.value)}
            className={`relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 ${
              selected.includes(interest.value)
                ? 'ring-4 ring-emerald-200 shadow-lg shadow-emerald-100/50 scale-105'
                : 'hover:shadow-md hover:scale-102 border-2 border-gray-100 hover:border-gray-200'
            }`}
          >
            <div className={`p-6 text-center bg-gradient-to-br ${
              selected.includes(interest.value) ? interest.color : 'from-gray-50 to-gray-100'
            }`}>
              <div className="text-3xl mb-3">{interest.icon}</div>
              <p className={`font-semibold text-sm ${
                selected.includes(interest.value) ? 'text-white' : 'text-gray-700'
              }`}>
                {interest.label}
              </p>
              
              {selected.includes(interest.value) && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-lg"
                >
                  <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                </motion.div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
      
      <div className="text-center p-4 bg-emerald-50 rounded-xl">
        <p className="text-emerald-700 font-medium text-sm">
          {selected.length === 0 ? "Choose at least one category to continue" : 
           `Perfect! You've selected ${selected.length} categor${selected.length === 1 ? 'y' : 'ies'}`}
        </p>
      </div>
    </div>
  );
}