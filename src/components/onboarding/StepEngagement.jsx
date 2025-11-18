import { useState, useEffect } from 'react';
import { Camera, Edit3, Share2, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const engagementOptions = [
  { 
    value: "photo", 
    label: "Photo Missions", 
    icon: <Camera className="w-8 h-8" />,
    description: "Capture beautiful moments at local businesses",
    color: "from-blue-400 to-blue-600"
  },
  { 
    value: "review", 
    label: "Written Reviews", 
    icon: <Edit3 className="w-8 h-8" />,
    description: "Share your experiences and help others discover great places",
    color: "from-purple-400 to-purple-600"
  },
  { 
    value: "social", 
    label: "Social Sharing", 
    icon: <Share2 className="w-8 h-8" />,
    description: "Spread the word about amazing businesses on social media",
    color: "from-pink-400 to-pink-600"
  },
];

export default function StepEngagement({ userData, onUpdate }) {
  const [selected, setSelected] = useState(userData.engagement_preferences || []);

  useEffect(() => {
    onUpdate({ engagement_preferences: selected });
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
          Choose how you'd like to engage with businesses. You can always change these preferences later.
        </p>
      </div>
      
      <div className="space-y-4">
        {engagementOptions.map((option, index) => (
          <motion.div
            key={option.value}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.15, duration: 0.5 }}
            onClick={() => toggleSelection(option.value)}
            className={`relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 ${
              selected.includes(option.value)
                ? 'ring-4 ring-emerald-200 shadow-lg shadow-emerald-100/50'
                : 'hover:shadow-md border-2 border-gray-100 hover:border-gray-200'
            }`}
          >
            <div className={`p-6 bg-gradient-to-r ${
              selected.includes(option.value) ? option.color : 'from-white to-gray-50'
            }`}>
              <div className="flex items-start space-x-4">
                <div className={`p-3 rounded-2xl flex-shrink-0 ${
                  selected.includes(option.value) 
                    ? 'bg-white/20 text-white' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {option.icon}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={`font-semibold text-lg ${
                      selected.includes(option.value) ? 'text-white' : 'text-gray-900'
                    }`}>
                      {option.label}
                    </h3>
                    {selected.includes(option.value) && (
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg"
                      >
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      </motion.div>
                    )}
                  </div>
                  <p className={`text-sm leading-relaxed ${
                    selected.includes(option.value) ? 'text-white/90' : 'text-gray-600'
                  }`}>
                    {option.description}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      
      <div className="text-center p-4 bg-blue-50 rounded-xl">
        <p className="text-blue-700 font-medium text-sm">
          {selected.length === 0 ? "Select your preferred activities to get started" : 
           `Great choice! You've selected ${selected.length} engagement type${selected.length === 1 ? '' : 's'}`}
        </p>
      </div>
    </div>
  );
}