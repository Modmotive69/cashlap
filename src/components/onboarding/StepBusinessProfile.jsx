import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Building, FileText, MapPin, Globe } from 'lucide-react';
import { motion } from 'framer-motion';

export default function StepBusinessProfile({ businessData, onUpdate }) {
  const handleChange = (field, value) => {
    onUpdate({ ...businessData, [field]: value });
  };

  const inputFields = [
    {
      field: 'business_name',
      placeholder: 'Your Business Name',
      icon: <Building className="w-5 h-5 text-gray-400" />,
      required: true
    },
    {
      field: 'business_address',
      placeholder: 'Business Address',
      icon: <MapPin className="w-5 h-5 text-gray-400" />,
      required: true
    },
    {
      field: 'business_website',
      placeholder: 'Website (optional)',
      icon: <Globe className="w-5 h-5 text-gray-400" />,
      required: false
    }
  ];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-gray-600 leading-relaxed">
          Help customers find and learn about your business with some basic information.
        </p>
      </div>

      <div className="space-y-5">
        {inputFields.map((field, index) => (
          <motion.div
            key={field.field}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.4 }}
            className="relative group"
          >
            <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
              {field.icon}
            </div>
            <Input
              placeholder={field.placeholder}
              value={businessData[field.field] || ''}
              onChange={(e) => handleChange(field.field, e.target.value)}
              className="pl-12 h-14 text-base rounded-xl border-2 border-gray-100 focus:border-blue-300 focus:ring-4 focus:ring-blue-100 transition-all duration-200 bg-white/80 backdrop-blur-sm"
              required={field.required}
            />
          </motion.div>
        ))}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="relative group"
        >
          <div className="absolute left-4 top-4 z-10">
            <FileText className="w-5 h-5 text-gray-400" />
          </div>
          <Textarea
            placeholder="Tell customers what makes your business special..."
            value={businessData.business_description || ''}
            onChange={(e) => handleChange('business_description', e.target.value)}
            className="pl-12 pt-4 min-h-[120px] text-base rounded-xl border-2 border-gray-100 focus:border-blue-300 focus:ring-4 focus:ring-blue-100 transition-all duration-200 bg-white/80 backdrop-blur-sm resize-none"
          />
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4 }}
        className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100"
      >
        <p className="text-blue-700 text-sm font-medium text-center leading-relaxed">
          💡 This information helps potential customers discover your business and understand what you offer.
        </p>
      </motion.div>
    </div>
  );
}