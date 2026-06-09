import React, { useState, useEffect, useCallback, useMemo } from "react";
import { User, Campaign, Business, Notification, Mission } from "@/entities/all";
import { UploadFile } from "@/integrations/Core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import AuthGuard from "@/components/auth/AuthGuard";
import {
  Plus,
  Edit,
  Play,
  Pause,
  BarChart3,
  Target,
  X,
  Upload,
  Loader2,
  Trash2,
  AlertTriangle,
  MapPin,
  QrCode,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  FileText,
  Check,
  Briefcase // NEW IMPORT
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createPageUrl } from "@/utils";
import { sanitize, sanitizeObject } from "@/components/utils/sanitizer";
import QRCodeGenerator from "@/components/qr/QRCodeGenerator";
import CampaignAnalyticsDetail from "@/components/analytics/CampaignAnalyticsDetail";
import { geocodeAddress } from "@/functions/geocodeAddress";
import { increaseCampaignBudget } from "@/functions/increaseCampaignBudget"; // NEW IMPORT

import { rateLimiter } from '@/components/utils/rateLimiter'; // Correctly import the rateLimiter object
import { toast } from 'sonner';

// Initial state for the campaign form
const initialFormState = {
  title: "",
  description: "",
  reward_amount: "",
  category: "services",
  max_participants: "",
  start_date: "",
  end_date: "",
  requirements: [""],
  locations: [{ address: "", latitude: null, longitude: null }],
  image_url: "",
  budget: ""
};

// Placeholder / Extracted CampaignForm Component
function CampaignForm({ businessId, onCampaignUpdated, existingCampaign, onCancel }) {
  const [localFormValues, setLocalFormValues] = useState(existingCampaign ? {
    ...initialFormState,
    ...existingCampaign,
    reward_amount: existingCampaign.reward_amount ? String(existingCampaign.reward_amount) : "",
    max_participants: existingCampaign.max_participants ? String(existingCampaign.max_participants) : "",
    budget: existingCampaign.budget ? String(existingCampaign.budget) : "",
    start_date: existingCampaign.start_date ? existingCampaign.start_date.split('T')[0] : "",
    end_date: existingCampaign.end_date ? existingCampaign.end_date.split('T')[0] : "",
    requirements: existingCampaign.requirements && existingCampaign.requirements.length > 0 ? existingCampaign.requirements : [""],
    locations: existingCampaign.locations && existingCampaign.locations.length > 0 ? existingCampaign.locations.map(loc => ({ ...loc })) : [{ address: "", latitude: null, longitude: null }],
    image_url: existingCampaign.image_url || ""
  } : initialFormState);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState({});
  const [formError, setFormError] = useState('');

  // Reset form values and verification status when existingCampaign prop changes
  useEffect(() => {
    if (existingCampaign) {
      setLocalFormValues({
        ...initialFormState,
        ...existingCampaign,
        reward_amount: existingCampaign.reward_amount ? String(existingCampaign.reward_amount) : "",
        max_participants: existingCampaign.max_participants ? String(existingCampaign.max_participants) : "",
        budget: existingCampaign.budget ? String(existingCampaign.budget) : "",
        start_date: existingCampaign.start_date ? existingCampaign.start_date.split('T')[0] : "",
        end_date: existingCampaign.end_date ? existingCampaign.end_date.split('T')[0] : "",
        requirements: existingCampaign.requirements && existingCampaign.requirements.length > 0 ? existingCampaign.requirements : [""],
        locations: existingCampaign.locations && existingCampaign.locations.length > 0 ? existingCampaign.locations.map(loc => ({ ...loc })) : [{ address: "", latitude: null, longitude: null }],
        image_url: existingCampaign.image_url || ""
      });
      const initialStatus = {};
      (existingCampaign.locations || []).forEach((loc, index) => {
        initialStatus[index] = (loc.latitude && loc.longitude) ? 'verified' : 'unverified';
      });
      setVerificationStatus(initialStatus);
    } else {
      setLocalFormValues(initialFormState);
      setVerificationStatus({ 0: 'unverified' });
    }
    setFormError('');
  }, [existingCampaign]);

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormError('Image size should be less than 5MB');
      return;
    }
    setUploadingImage(true);
    setFormError('');
    try {
      const result = await UploadFile({ file });
      setLocalFormValues(prev => ({ ...prev, image_url: result.file_url }));
    } catch (error) {
      console.error("Error uploading image:", error);
      setFormError('Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFormChange = (field, value) => {
    setFormError('');
    setLocalFormValues(prev => ({ ...prev, [field]: value }));
  };

  const handleLocationChange = (index, value) => {
    const newLocations = [...localFormValues.locations];
    newLocations[index] = { address: value, latitude: null, longitude: null };
    setLocalFormValues(prev => ({ ...prev, locations: newLocations }));
    setVerificationStatus(prev => ({ ...prev, [index]: 'unverified' }));
    setFormError('');
  };

  const addLocation = () => {
    setFormError('');
    const newIndex = localFormValues.locations.length;
    setLocalFormValues(prev => ({ ...prev, locations: [...prev.locations, { address: "", latitude: null, longitude: null }] }));
    setVerificationStatus(prev => ({ ...prev, [newIndex]: 'unverified' }));
  };

  const removeLocation = (index) => {
    setFormError('');
    const newLocations = localFormValues.locations.filter((_, i) => i !== index);
    setLocalFormValues({ ...localFormValues, locations: newLocations });

    const newStatus = {};
    newLocations.forEach((loc, i) => {
      const oldIndex = i < index ? i : i + 1;
      if (verificationStatus[oldIndex]) {
        newStatus[i] = verificationStatus[oldIndex];
      } else {
        newStatus[i] = 'unverified';
      }
    });
    setVerificationStatus(newStatus);
  };

  const handleVerifyAddress = async (index) => {
    const location = localFormValues.locations[index];
    if (!location.address || !location.address.trim()) {
      setFormError("Address cannot be empty.");
      return;
    }

    setVerificationStatus(prev => ({ ...prev, [index]: 'verifying' }));
    setFormError('');

    try {
      const response = await geocodeAddress({ address: location.address });

      if (response.data && response.data.success) {
        const { latitude, longitude, formatted_address } = response.data;

        const newLocations = [...localFormValues.locations];
        newLocations[index] = {
          ...newLocations[index],
          latitude: latitude,
          longitude: longitude,
          address: formatted_address || location.address
        };
        setLocalFormValues(prev => ({ ...prev, locations: newLocations }));
        setVerificationStatus(prev => ({ ...prev, [index]: 'verified' }));

      } else {
        throw new Error(response.data?.error || 'Geocoding failed');
      }

    } catch (error) {
      console.error(`Geocoding failed for ${location.address}:`, error);
      setFormError(error.message || `Could not verify address: "${location.address}". Please check that it's a complete, specific address and try again.`);
      setVerificationStatus(prev => ({ ...prev, [index]: 'failed' }));
    }
  };

  const addRequirement = () => {
    setFormError('');
    setLocalFormValues(prev => ({ ...prev, requirements: [...prev.requirements, ""] }));
  };
  const updateRequirement = (index, value) => {
    const updated = [...localFormValues.requirements];
    updated[index] = value;
    setLocalFormValues({ ...localFormValues, requirements: updated });
    setFormError('');
  };
  const removeRequirement = (index) => {
    setFormError('');
    setLocalFormValues({ ...localFormValues, requirements: localFormValues.requirements.filter((_, i) => i !== index) });
  };

  const handleSubmit = async (e, saveAsDraft = false) => {
    e.preventDefault();

    if (isSubmitting) {
      console.log('Form submission already in progress');
      return;
    }

    const finalStatus = saveAsDraft ? 'draft' : 'active';

    const now = Date.now();
    const lastSubmission = localStorage.getItem('last_campaign_submission');
    if (lastSubmission && (now - parseInt(lastSubmission)) < 10000) {
      setFormError('Please wait at least 10 seconds between campaign submissions to prevent server overload.');
      return;
    }

    const userSubmissionKey = `last_campaign_submission_${businessId}`;
    const lastUserSubmission = localStorage.getItem(userSubmissionKey);
    if (lastUserSubmission && (now - parseInt(lastUserSubmission)) < 15000) {
      setFormError('You can only submit one campaign every 15 seconds. Please wait before creating another.');
      return;
    }

    localStorage.setItem('last_campaign_submission', now.toString());
    localStorage.setItem(userSubmissionKey, now.toString());

    if (!businessId) {
      setFormError("Cannot create campaign: Your business profile is not fully set up. Please visit the Dashboard.");
      return;
    }

    if (!localFormValues.title || localFormValues.title.trim().length < 3) {
      setFormError("Campaign title must be at least 3 characters long.");
      return;
    }

    // Only require reward amount if activating
    if (finalStatus === 'active' && (!localFormValues.reward_amount || parseFloat(localFormValues.reward_amount) <= 0)) {
      setFormError("Please set a valid reward amount greater than $0 to activate.");
      return;
    }

    if (localFormValues.reward_amount && parseFloat(localFormValues.reward_amount) > 1000) {
      setFormError("Reward amount cannot exceed $1000 per campaign for security reasons.");
      return;
    }

    // Budget must cover at least reward_amount × max_participants
    const rewardVal = parseFloat(localFormValues.reward_amount) || 0;
    const maxPart = parseInt(localFormValues.max_participants) || 0;
    const budgetVal = parseFloat(localFormValues.budget) || 0;
    if (finalStatus === 'active' && rewardVal > 0 && maxPart > 0 && budgetVal > 0 && budgetVal < rewardVal * maxPart) {
      setFormError(`Budget ($${budgetVal.toFixed(2)}) is less than reward × participants ($${rewardVal.toFixed(2)} × ${maxPart} = $${(rewardVal * maxPart).toFixed(2)}). Increase budget or reduce participants.`);
      return;
    }

    const unverifiedLocations = localFormValues.locations.filter((loc, index) =>
      loc.address && loc.address.trim() !== '' && verificationStatus[index] !== 'verified'
    );

    if (finalStatus === 'active' && unverifiedLocations.length > 0) {
      setFormError("Please make sure all location addresses are verified before activating.");
      return;
    }

    const validLocations = localFormValues.locations.filter(loc => loc.address && loc.address.trim() !== '' && loc.latitude && loc.longitude);

    if (finalStatus === 'active' && validLocations.length === 0) {
      setFormError("Please add and verify at least one location to activate your campaign.");
      return;
    }

    // NEW: Check business balance only when activating a new or draft campaign
    if (finalStatus === 'active' && (!existingCampaign || existingCampaign.status === 'draft')) {
      try {
        const currentUser = await User.me();
        const businessBalance = currentUser.business_balance || 0;
        const rewardAmount = parseFloat(localFormValues.reward_amount);
        
        // This check ensures we don't proceed if reward amount is invalid for an active campaign
        if (isNaN(rewardAmount) || rewardAmount <= 0) {
            setFormError("A valid reward amount is required to activate a campaign.");
            return;
        }

        const maxParticipants = localFormValues.max_participants && parseInt(localFormValues.max_participants) > 0 
                               ? parseInt(localFormValues.max_participants) 
                               : 100; 
        const estimatedCampaignCost = rewardAmount * maxParticipants;

        if (businessBalance < estimatedCampaignCost) {
          setFormError(`Insufficient funds. This campaign could cost up to $${estimatedCampaignCost.toFixed(2)} (${maxParticipants} participants × $${rewardAmount.toFixed(2)}), but your balance is only $${businessBalance.toFixed(2)}. You can save as a draft and add funds.`);
          return;
        }

        // Warn if balance is getting low (less than 2x the campaign cost)
        if (businessBalance < (estimatedCampaignCost * 2)) {
          const proceed = window.confirm(
            `Warning: Your current balance is $${businessBalance.toFixed(2)}. This campaign could cost up to $${estimatedCampaignCost.toFixed(2)}.\n\n` +
            `After this campaign, you may not have enough funds for additional campaigns. Do you want to proceed?`
          );
          
          if (!proceed) {
            return;
          }
        }
      } catch (error) {
        console.error("Error checking business balance:", error);
        setFormError("Unable to verify business balance. Please try again or contact support.");
        return;
      }
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const existingCampaigns = await Campaign.filter({ business_id: businessId });

      if (!existingCampaign && existingCampaigns.length >= 50) {
        setFormError("You've reached the maximum limit of 50 campaigns per business. Please edit or delete existing campaigns first.");
        setIsSubmitting(false);
        return;
      }

      const duplicateTitleCampaigns = existingCampaigns.filter(campaign =>
        campaign.title.toLowerCase().trim() === localFormValues.title.toLowerCase().trim() &&
        (!existingCampaign || campaign.id !== existingCampaign.id)
      );

      if (duplicateTitleCampaigns.length > 0) {
        setFormError("A campaign with this title already exists. Please choose a different title.");
        setIsSubmitting(false);
        return;
      }

      const finalCampaignData = {
        title: sanitize(localFormValues.title.trim()),
        description: sanitize(localFormValues.description ? localFormValues.description.trim() : ''),
        business_id: businessId,
        locations: validLocations.map(loc => ({
          latitude: loc.latitude,
          longitude: loc.longitude,
          address: sanitize(loc.address),
        })),
        reward_amount: Math.min(parseFloat(localFormValues.reward_amount) || 0, 1000),
        max_participants: localFormValues.max_participants ? Math.min(parseInt(localFormValues.max_participants), 10000) : undefined,
        budget: localFormValues.budget ? Math.min(parseFloat(localFormValues.budget), 100000) : undefined,
        category: sanitize(localFormValues.category || 'services'),
        requirements: localFormValues.requirements.filter(req => req && req.trim() !== "").map(req => sanitize(req.trim())).slice(0, 20),
        start_date: localFormValues.start_date || null,
        end_date: localFormValues.end_date || null,
        image_url: sanitize(localFormValues.image_url || '') || null,
        status: finalStatus, // Set status dynamically
        current_participants: existingCampaign ? existingCampaign.current_participants : 0,
        notifications_sent: existingCampaign ? existingCampaign.notifications_sent : {}
      };

      if (finalCampaignData.start_date && finalCampaignData.end_date) {
        const startDate = new Date(finalCampaignData.start_date);
        const endDate = new Date(finalCampaignData.end_date);

        if (endDate <= startDate) {
          setFormError("End date must be after start date.");
          setIsSubmitting(false);
          return;
        }

        const oneYearFromNow = new Date();
        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

        if (startDate > oneYearFromNow) {
          setFormError("Campaign start date cannot be more than one year in the future.");
          setIsSubmitting(false);
          return;
        }
      }

      let submissionSuccess = false;
      let submissionAttempts = 0;
      const maxSubmissionAttempts = 3;
      const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

      while (!submissionSuccess && submissionAttempts < maxSubmissionAttempts) {
        try {
          submissionAttempts++;

          if (existingCampaign) {
            await Campaign.update(existingCampaign.id, finalCampaignData);
          } else {
            await Campaign.create(finalCampaignData);
          }

          submissionSuccess = true;
        } catch (submissionError) {
          console.error(`Campaign submission attempt ${submissionAttempts} failed:`, submissionError);

          if (submissionAttempts < maxSubmissionAttempts) {
            const retryDelay = Math.pow(2, submissionAttempts) * 1000 + Math.random() * 1000;
            await delay(retryDelay);
            console.log(`Retrying campaign submission in ${retryDelay}ms...`);
          } else {
            throw submissionError;
          }
        }
      }

      // Clear cache after successful operation
      rateLimiter.clearCache();
      onCampaignUpdated();

    } catch (error) {
      console.error("Error submitting campaign:", error);

      let userErrorMessage = "Failed to save campaign. Please try again.";

      if (error.status === 429 || String(error.message).includes('rate') || String(error.message).includes('limit')) {
        userErrorMessage = "Server is experiencing high traffic. Please wait 2-3 minutes before trying again.";
        rateLimiter.markRateLimited();
      } else if (error.status === 503 || error.status === 502 || error.status === 504) {
        userErrorMessage = "Server is temporarily unavailable. Please try again in a few minutes.";
      } else if (String(error.message).includes('duplicate') || String(error.message).includes('already exists')) {
        userErrorMessage = "A campaign with similar details already exists. Please modify your campaign.";
      } else if (String(error.message).includes('validation') || String(error.message).includes('required')) {
        userErrorMessage = "Please check all required fields and try again.";
      } else if (String(error.message).includes('timeout')) {
        userErrorMessage = "Request timed out due to high server load. Please try again with fewer locations.";
      }

      setFormError(userErrorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isNew = !existingCampaign;
  const isDraft = existingCampaign && existingCampaign.status === 'draft';
  const isActive = existingCampaign && existingCampaign.status === 'active';

  return (
    <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="bg-white p-6 rounded-lg shadow-lg relative">
      <style>
        {`
          .campaign-form input::placeholder,
          .campaign-form textarea::placeholder {
            opacity: 0.5;
            color: #9ca3af; /* Tailwind gray-400 equivalent */
          }
        `}
      </style>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">{existingCampaign ? "Edit Campaign" : "Create New Campaign"}</h2>
        <Button type="button" variant="ghost" size="icon" onClick={onCancel}><X className="w-5 h-5" /></Button>
      </div>
      <form onSubmit={(e) => e.preventDefault()} className="space-y-6 campaign-form"> {/* Prevent default submit here to handle it in button clicks */}
        <div className="space-y-4">
          <h3 className="text-md font-medium text-gray-900 border-b pb-2">Basic Information</h3>
          <div><label className="block text-sm font-medium mb-2">Campaign Title</label><Input value={localFormValues.title} onChange={(e) => handleFormChange('title', e.target.value)} placeholder="e.g., Share Your Coffee Experience, Try Our New Pizza Special, Post Your Workout" required /></div>
          <div><label className="block text-sm font-medium mb-2">Description</label><Textarea value={localFormValues.description} onChange={(e) => handleFormChange('description', e.target.value)} placeholder="e.g., Visit our cafe, order any drink, and share a photo on Instagram with #YourCafeExperience. Tag us and show your followers why our coffee is the best in town!" rows={3} /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-2">Category</label><Select value={localFormValues.category} onValueChange={(value) => handleFormChange('category', value)}><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger><SelectContent><SelectItem value="restaurant">Restaurant</SelectItem><SelectItem value="cafe">Cafe</SelectItem><SelectItem value="retail">Retail</SelectItem><SelectItem value="fitness">Fitness</SelectItem><SelectItem value="beauty">Beauty</SelectItem><SelectItem value="entertainment">Entertainment</SelectItem><SelectItem value="services">Services</SelectItem><SelectItem value="health">Health</SelectItem></SelectContent></Select></div>
            <div><label className="block text-sm font-medium mb-2">Reward Amount ($)</label><Input type="number" value={localFormValues.reward_amount} onChange={(e) => handleFormChange('reward_amount', e.target.value)} placeholder="e.g., 5.00, 10.00, 25.00" step="0.01" min="0" /></div> {/* Removed required for draft */}
          </div>
        </div>
        <div className="space-y-4">
          <h3 className="text-md font-medium text-gray-900 border-b pb-2">Campaign Image</h3>
          {localFormValues.image_url && <div className="relative w-full h-32 sm:h-48 bg-gray-100 rounded-lg overflow-hidden"><img src={localFormValues.image_url} alt="Campaign thumbnail" className="w-full h-full object-cover" /><Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 bg-white/80 hover:bg-white" onClick={() => setLocalFormValues({ ...localFormValues, image_url: "" })}><X className="w-4 h-4" /></Button></div>}
          <div><label className="cursor-pointer"><input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploadingImage} /><div className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-[var(--cashlap-blue)] transition-colors">{uploadingImage ? <Loader2 className="w-5 h-5 animate-spin text-[var(--cashlap-blue)]" /> : <Upload className="w-5 h-5 text-gray-400" />}<span className="text-sm text-gray-600">{uploadingImage ? 'Uploading...' : 'Upload Campaign Image'}</span></div></label><p className="text-xs text-gray-500 mt-2">Max file size: 5MB</p></div>
        </div>
        <div className="space-y-4">
          <h3 className="text-md font-medium text-gray-900 border-b pb-2">Budget & Participants</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-2">Budget ($)</label><Input type="number" value={localFormValues.budget} onChange={(e) => handleFormChange('budget', e.target.value)} placeholder="e.g., 500.00, 1000.00" step="0.01" min="0" /></div>
            <div><label className="block text-sm font-medium mb-2">Max Participants</label><Input type="number" value={localFormValues.max_participants} onChange={(e) => handleFormChange('max_participants', e.target.value)} placeholder="e.g., 50, 100, 200" min="0" /></div>
            <div><label className="block text-sm font-medium mb-2">Start Date</label><Input type="date" value={localFormValues.start_date} onChange={(e) => handleFormChange('start_date', e.target.value)} /></div>
            <div><label className="block text-sm font-medium mb-2">End Date</label><Input type="date" value={localFormValues.end_date} onChange={(e) => handleFormChange('end_date', e.target.value)} /></div>
          </div>
        </div>
        <div className="space-y-4">
          <h3 className="text-md font-medium text-gray-900 border-b pb-2">Locations (up to 10)</h3>
          <div className="space-y-3">
            {localFormValues.locations.map((location, index) => (
              <div key={index}>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <Input
                    value={location.address}
                    onChange={(e) => handleLocationChange(index, e.target.value)}
                    placeholder="e.g., 123 Main Street, Downtown, City, State 12345"
                    className="flex-grow"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleVerifyAddress(index)}
                    disabled={!location.address || verificationStatus[index] === 'verifying'}
                    className="w-24 justify-center"
                  >
                    {verificationStatus[index] === 'verifying' ? <Loader2 className="w-4 h-4 animate-spin" /> :
                      verificationStatus[index] === 'verified' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> :
                        'Verify'}
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeLocation(index)} disabled={localFormValues.locations.length === 1} className="text-gray-400 hover:text-red-500 flex-shrink-0"><Trash2 className="w-4 h-4" /></Button>
                </div>
                {verificationStatus[index] === 'failed' && <p className="text-xs text-red-500 mt-1 ml-6">Verification failed. Please provide a more specific address.</p>}
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addLocation} disabled={localFormValues.locations.length >= 10} className="w-full"><Plus className="w-4 h-4 mr-2" /> Add Location</Button>
          </div>
        </div>
        <div className="space-y-4">
          <h3 className="text-md font-medium text-gray-900 border-b pb-2">Requirements</h3>
          <div className="space-y-3">
            {localFormValues.requirements.map((requirement, index) => <div key={index} className="flex gap-2"><Input value={requirement} onChange={(e) => updateRequirement(index, e.target.value)} placeholder={`e.g., ${index === 0 ? 'Post a photo on Instagram with our hashtag' : index === 1 ? 'Tag @yourbusiness in your story' : 'Leave a Google review'}`} className="flex-grow" /><Button type="button" variant="outline" size="sm" onClick={() => removeRequirement(index)} disabled={localFormValues.requirements.length === 1} className="flex-shrink-0">Remove</Button></div>)}
            <Button type="button" variant="outline" onClick={addRequirement} className="w-full"><Plus className="w-4 h-4 mr-2" /> Add Requirement</Button>
          </div>
        </div>
        {formError && (
          <div className="mt-6 p-3 bg-red-50 border border-red-200 rounded-lg text-center">
            <p className="text-sm text-red-700">{formError}</p>
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
          <Button
            type="submit"
            onClick={(e) => handleSubmit(e, false)}
            disabled={uploadingImage || isSubmitting}
            className="flex-1 bg-[var(--cashlap-green)] hover:opacity-90 text-white font-bold"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Check className="w-5 h-5 mr-2" />
                {isNew || isDraft ? 'Save & Go Live' : 'Save Changes'}
              </>
            )}
          </Button>

          {(isNew || isDraft) && (
             <Button
              type="submit"
              variant="outline"
              onClick={(e) => handleSubmit(e, true)}
              disabled={uploadingImage || isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <FileText className="w-5 h-5 mr-2" />
                  Save as Draft
                </>
              )}
            </Button>
          )}

          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting} className="flex-1">
            <X className="w-5 h-5 mr-2" />
            Cancel
          </Button>
        </div>
        {(isNew || isDraft) && (
          <p className="text-xs text-gray-500 text-center -mt-2">
            💡 Campaigns must be live to appear on the Player Explore page
          </p>
        )}
      </form>
    </motion.div>
  );
}

// Custom hook to encapsulate data fetching and state management
const useCampaignData = () => {
  const [user, setUser] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [missions, setMissions] = useState([]); // NEW STATE FOR MISSIONS
  const [submissionCounts, setSubmissionCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pageError, setPageError] = useState('');
  const [rateLimitCooldown, setRateLimitCooldown] = useState(0);

  const refreshCampaigns = useCallback(async (forceRefresh = false) => {
    // Check rate limiting first
    if (!forceRefresh && rateLimiter.isRateLimited()) { // Use the rateLimiter object
      const lastRateLimit = localStorage.getItem('last_rate_limit_time');
      const remaining = Math.ceil((rateLimiter.RATE_LIMIT_COOLDOWN - (Date.now() - parseInt(lastRateLimit))) / 1000);
      setPageError(`Rate limited. Please wait ${remaining} seconds before trying again.`);
      setRateLimitCooldown(remaining);
      setLoading(false);
      setIsRefreshing(false);
      return;
    }

    // Try cache first unless forcing refresh
    if (!forceRefresh) {
      const cachedData = rateLimiter.getCachedData(); // Use the rateLimiter object
      if (cachedData) {
        setUser(cachedData.user);
        setCampaigns(cachedData.campaigns);
        setSubmissionCounts(cachedData.submissionCounts);
        setMissions(cachedData.missions); // Load missions from cache
        setLoading(false);
        return;
      }
    }

    // Set loading states
    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    
    setPageError('');

    try {
      // Get user data
      let currentUser = await User.me();
      setUser(currentUser);

      let fetchedCampaigns = [];
      let attempt1Success = false;
      let attempt2Success = false;

      // Attempt 1: Fetch by business_id if available
      if (currentUser.business_id) {
        try {
          // Add small delay before first attempt to avoid immediate rate limit if previous action was recent
          await new Promise(resolve => setTimeout(resolve, 500)); 
          const campaignsByBusinessId = await Campaign.filter({ business_id: currentUser.business_id }, '-created_date');
          fetchedCampaigns.push(...campaignsByBusinessId);
          attempt1Success = true;
        } catch (err) {
          console.warn("Error filtering campaigns by business_id (Attempt 1, continuing recovery):", err);
        }
      }

      // Add small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Attempt 2: Fetch all (or a limited list) and filter by created_by email as a fallback/catch-all
      try {
        const allSystemCampaigns = await Campaign.list('-created_date', 100); // Limit to 100 for performance
        
        const campaignsByEmail = allSystemCampaigns.filter(campaign => 
          campaign.created_by === currentUser.email || 
          (currentUser.business_id && campaign.business_id === currentUser.business_id) || // Redundant but harmless for robustness
          (currentUser.business_name && campaign.title && campaign.title.toLowerCase().includes(currentUser.business_name.toLowerCase()))
        );
        fetchedCampaigns.push(...campaignsByEmail);
        attempt2Success = true;
      } catch (err) {
        console.warn("Error listing all campaigns (Attempt 2, continuing recovery):", err);
      }

      // Consolidate and deduplicate campaigns
      const uniqueCampaigns = new Map();
      fetchedCampaigns.forEach(campaign => uniqueCampaigns.set(campaign.id, campaign));
      let userCampaigns = Array.from(uniqueCampaigns.values());

      // Aggressive recovery check: If both primary attempts failed to retrieve any data
      if (!attempt1Success && !attempt2Success && userCampaigns.length === 0 && currentUser.business_id) { // Only try if user has a business_id
          try {
              // Add delay before third attempt
              await new Promise(resolve => setTimeout(resolve, 1500));
              // Attempt 3: Fetch with higher limit as a final fallback
              const widerSystemCampaigns = await Campaign.list('-created_date', 500); // Increased limit for aggressive recovery
              const widerCampaignsByEmail = widerSystemCampaigns.filter(campaign => 
                  campaign.created_by === currentUser.email || 
                  (currentUser.business_id && campaign.business_id === currentUser.business_id) || 
                  (currentUser.business_name && campaign.title && campaign.title.toLowerCase().includes(currentUser.business_name.toLowerCase()))
              );
              fetchedCampaigns.push(...widerCampaignsByEmail);

              // Re-consolidate after the third attempt
              uniqueCampaigns.clear(); // Clear previous map
              fetchedCampaigns.forEach(campaign => uniqueCampaigns.set(campaign.id, campaign));
              userCampaigns = Array.from(uniqueCampaigns.values());

          } catch (err) {
              console.error("Critical: Failed even wider campaign list attempt (Attempt 3):", err);
          }
      }

      // Final validation to ensure campaigns truly belong to the user
      const validatedCampaigns = userCampaigns.filter(campaign => {
        const isOwnedByBusinessId = currentUser.business_id && campaign.business_id === currentUser.business_id;
        const isCreatedByUserEmail = campaign.created_by === currentUser.email;
        
        if (isOwnedByBusinessId || isCreatedByUserEmail) {
          return true;
        }
        return false;
      });

      // IMPORTANT: Set campaigns state immediately after validation
      setCampaigns(validatedCampaigns);

      // Add delay before fetching submission counts
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get submission counts
      let counts = {};
      let fetchedMissions = []; // Initialize fetchedMissions
      const campaignIds = validatedCampaigns.map(c => c.id);
      if (campaignIds.length > 0) {
        try {
          fetchedMissions = await Mission.filter({ campaign_id: { $in: campaignIds } }); // Fetch ALL missions for these campaigns
          const pendingMissions = fetchedMissions.filter(m => m.status === 'submitted'); // Filter for pending missions for submissionCounts
          counts = pendingMissions.reduce((acc, mission) => {
            acc[mission.campaign_id] = (acc[mission.campaign_id] || 0) + 1;
            return acc;
          }, {});
        } catch (missionError) {
          console.error('Error fetching missions or mission counts:', missionError);
        }
      }
      setSubmissionCounts(counts);
      setMissions(fetchedMissions); // Set the fetched missions

      // Cache the data
      rateLimiter.setCachedData({ // Use the rateLimiter object
        user: currentUser,
        campaigns: validatedCampaigns,
        submissionCounts: counts,
        missions: fetchedMissions // Include missions in cache
      });

    } catch (error) {
      console.error("Error loading campaign data:", error);
      
      if (error.status === 429 || error.message?.includes('Rate limit')) {
        rateLimiter.markRateLimited(); // Use the rateLimiter object
        const remaining = Math.ceil(rateLimiter.RATE_LIMIT_COOLDOWN / 1000); // Use the rateLimiter object
        setPageError(`Rate limit exceeded. Cooling down for ${remaining} seconds. Please wait before trying again.`);
        setRateLimitCooldown(remaining);
      } else if (error.status === 503 || error.status === 502 || error.status === 504) {
        setPageError('Server temporarily unavailable. Please try again in a few minutes.');
      } else {
        setPageError('Failed to load campaign data. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Load data on mount
  useEffect(() => {
    refreshCampaigns();
  }, [refreshCampaigns]);

  // Rate limit cooldown effect
  useEffect(() => {
    if (rateLimitCooldown > 0) {
      const timer = setTimeout(() => {
        setRateLimitCooldown(rateLimitCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [rateLimitCooldown]);

  return {
    user,
    campaigns,
    missions, // RETURN MISSIONS
    submissionCounts,
    loading,
    isRefreshing,
    pageError,
    setPageError, // Export the setter function
    rateLimitCooldown,
    refreshCampaigns,
    business: user?.business_id ? { id: user.business_id, name: user.business_name } : null
  };
};

function CampaignManager() { // Renamed from CampaignManagerContent
  const [showForm, setShowForm] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [isDeleting, setIsDeleting] = useState(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [budgetModal, setBudgetModal] = useState({ show: false, campaign: null, loading: false }); // NEW STATE
  const [businessEntity, setBusinessEntity] = useState(null); // NEW STATE
  const [businessEntityLoading, setBusinessEntityLoading] = useState(true); // NEW STATE

  const {
    user,
    campaigns,
    missions, // DESTRUCTURE MISSIONS
    submissionCounts,
    loading,
    isRefreshing,
    pageError,
    setPageError, // Destructure the setter function
    rateLimitCooldown,
    refreshCampaigns,
    business
  } = useCampaignData();

  // Check for complete business entity
  useEffect(() => {
    const checkBusinessEntity = async () => {
      if (user?.business_id) {
        try {
          const businessRecord = await Business.filter({ id: user.business_id });
          if (businessRecord.length > 0) {
            setBusinessEntity(businessRecord[0]);
          } else {
            setBusinessEntity(null); // Explicitly set to null if not found
          }
        } catch (error) {
          console.error('Error fetching business entity:', error);
          setBusinessEntity(null);
        }
      } else {
        setBusinessEntity(null); // No business_id, no entity
      }
      setBusinessEntityLoading(false);
    };

    if (user && user.account_type === 'business') {
      setBusinessEntityLoading(true); // Start loading state for business entity
      checkBusinessEntity();
    } else if (user && user.account_type !== 'business') {
      setBusinessEntityLoading(false); // Not a business user, no need to check
      setBusinessEntity(null);
    }
  }, [user]);

  const draftCampaigns = useMemo(() => campaigns.filter(c => c.status === 'draft'), [campaigns]);
  const activeCampaigns = useMemo(() => campaigns.filter(c => c.status === 'active'), [campaigns]);
  const pausedCampaigns = useMemo(() => campaigns.filter(c => c.status === 'paused'), [campaigns]);

  // MOVED renderCampaigns function definition BEFORE it is used.
  const renderCampaigns = (campaignList, emptyStateMessage) => {
    if (campaignList.length === 0) {
      return (
        <div className="p-8 text-center bg-white rounded-lg shadow-sm">
          <Target className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold mb-2">{emptyStateMessage}</h3>
          <p className="text-gray-500 mb-4">
            Start by creating a new campaign.
          </p>
          <Button onClick={() => setShowForm(true)} className="bg-[var(--cashlap-blue)] hover:opacity-90" disabled={rateLimitCooldown > 0}>Create Campaign</Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {campaignList.map((campaign) => {
          // Calculate current spending
          const approvedMissions = missions.filter(m => m.campaign_id === campaign.id && m.status === 'approved');
          const currentSpending = approvedMissions.reduce((total, m) => total + (m.final_reward_amount || m.reward_amount), 0);
          const budget = campaign.budget || 0;
          const spendingPercentage = budget > 0 ? (currentSpending / budget) * 100 : 0;
          
          return (
            <Card
              key={campaign.id}
              className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
              onClick={() => handleSelectCampaign(campaign)}
            >
              {campaign.image_url && (
                <div className="w-full h-32 sm:h-40 relative">
                  <img src={campaign.image_url} alt={campaign.title} className="w-full h-full object-cover" />
                  <div className="absolute top-2 right-2">
                    <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'} className={`bg-white/90 text-gray-900 text-xs capitalize ${
                        campaign.status === 'draft' ? 'bg-amber-100 text-amber-800' :
                        campaign.status === 'paused' ? 'bg-gray-200 text-gray-800' : ''
                    }`}>
                        {campaign.status}
                    </Badge>
                  </div>
                </div>
              )}
              <div className="p-3 sm:p-4 space-y-3">
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex-1">{campaign.title}</h3>
                    {!campaign.image_url && (
                      <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'} className={`text-xs capitalize ${
                          campaign.status === 'draft' ? 'bg-amber-100 text-amber-800' :
                          campaign.status === 'paused' ? 'bg-gray-200 text-gray-800' : ''
                      }`}>
                        {campaign.status}
                      </Badge>
                    )}
                  </div>
                  {campaign.description && (
                    <p className="text-sm text-gray-600 leading-snug line-clamp-2">{campaign.description}</p>
                  )}
                </div>
                
                {/* Budget Progress Bar (only for campaigns with budgets) */}
                {budget > 0 && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="text-gray-600">Budget Usage</span>
                      <span className={`font-medium ${spendingPercentage >= 90 ? 'text-red-600' : spendingPercentage >= 75 ? 'text-amber-600' : 'text-gray-700'}`}>
                        ${currentSpending.toFixed(2)} / ${budget.toFixed(2)} ({spendingPercentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          spendingPercentage >= 90 ? 'bg-red-500' : 
                          spendingPercentage >= 75 ? 'bg-amber-500' : 
                          'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(spendingPercentage, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-2 border-t border-b border-gray-100">
                  <div className="text-center p-1">
                    <p className="text-base sm:text-lg font-bold text-gray-900">${campaign.reward_amount}</p>
                    <p className="text-xs text-gray-500">Reward</p>
                  </div>
                  <div className="text-center p-1">
                    <p className="text-base sm:text-lg font-bold text-gray-900">{campaign.current_participants || 0}</p>
                    <p className="text-xs text-gray-500">Participants</p>
                  </div>
                  <div className="text-center p-1">
                    <p className="text-xs sm:text-sm font-medium text-gray-900">{campaign.start_date ? new Date(campaign.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}</p>
                    <p className="text-xs text-gray-500">Start Date</p>
                  </div>
                  <div className="text-center p-1">
                    <p className="text-xs sm:text-sm font-medium text-gray-900 capitalize">{campaign.category}</p>
                    <p className="text-xs text-gray-500">Category</p>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                  <Link to={`/SubmissionReview?campaignId=${campaign.id}`} className="w-full sm:flex-1">
                    <Button variant="outline" size="sm" className="w-full relative">
                      <MessageSquare className="w-3 h-3 mr-1.5" />
                      Review
                      {submissionCounts[campaign.id] > 0 && (
                        <Badge className="absolute -top-2 -right-2 bg-red-500 text-white px-1.5 py-0.5 text-xs rounded-full">{submissionCounts[campaign.id]}</Badge>
                      )}
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); toggleCampaignStatus(campaign); }} className="w-full sm:flex-1 sm:min-w-[80px]" disabled={rateLimitCooldown > 0 || campaign.status === 'draft'}> {/* Disable if draft */}
                    {campaign.status === 'active' ? (
                      <>
                        <Pause className="w-3 h-3 mr-1.5" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 mr-1.5" />
                        Activate
                      </>
                    )}
                  </Button>
                  <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleSelectCampaign(campaign); }} className="w-full sm:flex-1 sm:min-w-[80px]">
                    <Edit className="w-3 h-3 mr-1.5" />
                    Edit
                  </Button>
                  <Link to={createPageUrl(`CampaignQR?campaignId=${campaign.id}`)} className="w-full sm:flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                        <QrCode className="w-3 h-3 mr-1.5" />
                        QR
                    </Button>
                  </Link>
                  <Link to={createPageUrl(`campaign/${campaign.id}/analytics`)} className="w-full sm:flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                        <BarChart3 className="w-3 h-3 mr-1.5" />
                        Analytics
                    </Button>
                  </Link>
                  
                  {budget > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setBudgetModal({ show: true, campaign, loading: false }); 
                      }}
                      className="w-full sm:flex-1 sm:min-w-[100px] text-green-600 hover:text-green-700 hover:bg-green-50"
                      disabled={rateLimitCooldown > 0}
                    >
                      <Plus className="w-3 h-3 mr-1.5" />
                      Add Budget
                    </Button>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleDeleteCampaign(campaign.id); }}
                    className="w-full sm:flex-1 sm:min-w-[80px] text-red-600 hover:text-red-700 hover:bg-red-50"
                    disabled={isDeleting === campaign.id || rateLimitCooldown > 0}
                  >
                    {isDeleting === campaign.id ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <Trash2 className="w-3 h-3 mr-1.5" />}
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  // Define tabs with their content
  const tabs = [
    {
      name: 'Active',
      count: activeCampaigns.length,
      content: renderCampaigns(activeCampaigns, 'No Active Campaigns')
    },
    {
      name: 'Draft',
      count: draftCampaigns.length,
      content: renderCampaigns(draftCampaigns, 'No Draft Campaigns')
    },
    {
      name: 'Paused',
      count: pausedCampaigns.length,
      content: renderCampaigns(pausedCampaigns, 'No Paused Campaigns')
    }
  ];

  const handleSelectCampaign = (campaign) => {
    setSelectedCampaign(campaign);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setSelectedCampaign(null);
  };

  const handleCampaignUpdated = () => {
    setShowForm(false);
    setSelectedCampaign(null);
    rateLimiter.clearCache(); // Use the rateLimiter object
    refreshCampaigns(true);
  };

  const handleDeleteAllCampaigns = async () => {
    if (!window.confirm("Are you absolutely sure you want to delete ALL of your campaigns? This action is irreversible and will permanently remove all associated data.")) {
      return;
    }

    setIsDeletingAll(true);
    setPageError('');

    try {
      if (!user) {
        throw new Error("User data not loaded. Cannot delete campaigns.");
      }

      // Use the SAME logic as loadData to find campaigns
      let campaignsToDeleteRaw = [];

      // Attempt 1: Try business_id if available
      if (user.business_id) {
        try {
          const campaignsByBusinessId = await Campaign.filter({ business_id: user.business_id });
          campaignsToDeleteRaw.push(...campaignsByBusinessId);
        } catch (err) {
          console.warn("Failed to get campaigns by business_id for deletion:", err);
        }
      }

      // Attempt 2: Get all campaigns and filter by email/fuzzy matching (same as display logic)
      try {
        const allSystemCampaigns = await Campaign.list('-created_date', 100);
        const campaignsByEmail = allSystemCampaigns.filter(campaign => 
          campaign.created_by === user.email || 
          (user.business_id && campaign.business_id === user.business_id) ||
          (user.business_name && campaign.title && campaign.title.toLowerCase().includes(user.business_name.toLowerCase()))
        );
        campaignsToDeleteRaw.push(...campaignsByEmail);
      } catch (err) {
        console.warn("Failed to get campaigns by email for deletion:", err);
      }

      // Deduplicate campaigns
      const uniqueCampaigns = new Map();
      campaignsToDeleteRaw.forEach(campaign => uniqueCampaigns.set(campaign.id, campaign));
      const finalCampaignsToDelete = Array.from(uniqueCampaigns.values());
      
      // Final validation to ensure campaigns truly belong to the user (similar to loadData's validation)
      const validatedCampaignsToDelete = finalCampaignsToDelete.filter(campaign => {
        const isOwnedByBusinessId = user.business_id && campaign.business_id === user.business_id;
        const isCreatedByUserEmail = user.email && campaign.created_by === user.email; // Also check if user.email is available
        return isOwnedByBusinessId || isCreatedByUserEmail;
      });

      if (validatedCampaignsToDelete.length === 0) {
        toast.success("No campaigns found to delete that are linked to your business or user account.");
        setIsDeletingAll(false);
        return;
      }

      // Delete campaigns one by one with error handling
      let successfulDeletions = 0;
      let failedDeletions = 0;
      
      for (const campaign of validatedCampaignsToDelete) {
        try {
          await Campaign.delete(campaign.id);
          successfulDeletions++;
          
          // Small delay between deletions to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (deleteError) {
          console.error(`Failed to delete campaign ${campaign.id} (${campaign.title}):`, deleteError);
          failedDeletions++;
          // Mark rate limited if a deletion fails due to rate limit
          if (deleteError.status === 429 || deleteError.message?.includes('Rate limit')) {
            rateLimiter.markRateLimited(); // Use the rateLimiter object
          }
        }
      }

      if (successfulDeletions > 0) {
        toast.error(`Successfully deleted ${successfulDeletions} campaign(s).${failedDeletions > 0 ? ` ${failedDeletions} deletion(s) failed.` : ''}`);
        rateLimiter.clearCache(); // Use the rateLimiter object
        await refreshCampaigns(true);
      } else {
        // If no campaigns were successfully deleted but some were attempted
        if (failedDeletions > 0) {
          throw new Error(`Failed to delete any campaigns. ${failedDeletions} deletion(s) encountered errors.`);
        } else {
          // This should ideally not be reached if validatedCampaignsToDelete.length > 0
          throw new Error("No campaigns were deleted, despite campaigns being found. An unknown error occurred.");
        }
      }

    } catch (error) {
      console.error("Error in handleDeleteAllCampaigns:", error);
      if (error.status === 429 || error.message?.includes('Rate limit')) {
        rateLimiter.markRateLimited(); // Use the rateLimiter object
      } else {
        setPageError(`Failed to delete campaigns: ${error.message || "An unknown error occurred"}. Please try again.`);
      }
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleDeleteCampaign = async (campaignId) => {
    const confirmMessage = "Are you sure you want to delete this campaign? This cannot be undone.\n\nNote: During high traffic periods, deletion may take a few moments to process.";

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsDeleting(campaignId);
    setPageError('');

    try {
      await Campaign.delete(campaignId);
      rateLimiter.clearCache(); // Use the rateLimiter object
      await refreshCampaigns(true);
      if (selectedCampaign?.id === campaignId) {
        setSelectedCampaign(null);
        setShowForm(false);
      }
    } catch (error) {
      console.error("Error deleting campaign:", error);
      if (error.status === 429) {
        rateLimiter.markRateLimited(); // Use the rateLimiter object
        // The refreshCampaigns() call will handle setting pageError for rate limits.
      } else if (error.status === 404) {
        setPageError("Campaign may have already been deleted. Refreshing the page...");
        setTimeout(() => refreshCampaigns(true), 2000);
      } else {
        setPageError("Failed to delete campaign. Please try again in a few moments.");
      }
    } finally {
      setIsDeleting(null);
    }
  };

  const toggleCampaignStatus = async (campaign) => {
    const newStatus = campaign.status === 'active' ? 'paused' : 'active';
    setPageError('');
    try {
      await Campaign.update(campaign.id, { status: newStatus });
      rateLimiter.clearCache(); // Use the rateLimiter object
      await refreshCampaigns(true);
    } catch (error) {
      console.error("Error toggling campaign status:", error);

      if (error.status === 429) {
        rateLimiter.markRateLimited(); // Use the rateLimiter object
        // The refreshCampaigns() call will handle setting pageError for rate limits.
      } else {
        setPageError(`Failed to update campaign status: ${error.message}`);
      }
    }
  };

  const handleIncreaseBudget = async (campaign, additionalAmount) => {
    setBudgetModal(prev => ({ ...prev, loading: true }));
    
    try {
      // Perform client-side validation for additionalAmount
      if (isNaN(additionalAmount) || additionalAmount <= 0) {
        throw new Error('Please enter a valid positive amount.');
      }
      if (additionalAmount > (user?.business_balance || 0)) {
        throw new Error(`Insufficient funds. You only have $${(user?.business_balance || 0).toFixed(2)} in your business balance.`);
      }

      const response = await increaseCampaignBudget({
        campaignId: campaign.id,
        additionalBudget: parseFloat(additionalAmount)
      });

      if (response.data?.success) {
        setBudgetModal({ show: false, campaign: null, loading: false });
        rateLimiter.clearCache(); // Clear cache to ensure fresh data
        await refreshCampaigns(true); // Refresh to show updated budget and user balance
      } else {
        toast.error(response.data?.error || 'Failed to increase budget');
        setBudgetModal(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error('Error increasing budget:', error);
      toast.error(error.response?.data?.error || error.message || 'Failed to increase budget');
      setBudgetModal(prev => ({ ...prev, loading: false }));
    }
  };

  // Show loading screen on initial load for user data from useCampaignData
  if (loading && !user) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 border-4 border-[var(--cashlap-blue)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Campaign Manager</h3>
            <p className="text-gray-600">Getting your campaigns ready...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Business profile check - now requiring complete Business entity
  // This step runs after the initial user data is loaded (user is not null).
  // AuthGuard ensures user.business_id exists for business users.
  if (user?.account_type === 'business' && user?.business_id && businessEntityLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="max-w-4xl mx-auto w-full">
          <Card className="border-orange-500">
            <CardHeader className="p-4 sm:p-6"><CardTitle className="flex items-center gap-2 text-orange-600"><AlertTriangle className="w-5 h-5" />Setting Up Business Profile...</CardTitle></CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="mb-4 text-gray-700 text-center">Checking your business profile details...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Business entity missing or incomplete - require completion
  // This step runs after businessEntityLoading is false, meaning we've attempted to fetch the business entity.
  // AuthGuard guarantees user.business_id exists here.
  if (user?.account_type === 'business' && user?.business_id && !businessEntity && !businessEntityLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="max-w-4xl mx-auto w-full">
          <Card className="border-orange-500">
            <CardHeader className="p-4 sm:p-6"><CardTitle className="flex items-center gap-2 text-orange-600"><AlertTriangle className="w-5 h-5" />Complete Your Business Profile</CardTitle></CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <p className="mb-4 text-gray-700">You need to complete your business profile before creating campaigns. This ensures your campaigns display properly to players.</p>
              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <h4 className="font-semibold text-blue-900 mb-2">What we need:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Business name and description</li>
                  <li>• Business address and category</li>
                  <li>• Contact information</li>
                </ul>
              </div>
              <Link to={createPageUrl("Profile")}>
                <Button className="w-full bg-[var(--cashlap-blue)] hover:opacity-90">
                  <Briefcase className="w-4 h-4 mr-2" />
                  Complete Business Profile
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 flex-wrap gap-2 max-w-2xl mx-auto w-full">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaign Manager</h1>
          <p className="text-gray-600">Create and manage campaigns to attract customers</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <Button
            onClick={() => refreshCampaigns(true)}
            variant="outline"
            disabled={isRefreshing || rateLimitCooldown > 0}
            size="sm"
            className="text-xs sm:text-sm px-2 sm:px-3"
          >
            <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">
              {rateLimitCooldown > 0 ? `Wait ${rateLimitCooldown}s` : 'Refresh Data'}
            </span>
            <span className="sm:hidden">
              {rateLimitCooldown > 0 ? `${rateLimitCooldown}s` : 'Refresh'}
            </span>
          </Button>
          <Button
            onClick={handleDeleteAllCampaigns}
            variant="destructive"
            disabled={isDeletingAll || rateLimitCooldown > 0 || campaigns.length === 0}
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-xs sm:text-sm px-2 sm:px-3"
          >
            {isDeletingAll ? (
              <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 animate-spin" />
            ) : (
              <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            )}
            <span className="hidden sm:inline">Delete All ({campaigns.length})</span>
            <span className="sm:hidden">Delete ({campaigns.length})</span>
          </Button>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-[var(--cashlap-blue)] hover:opacity-90 text-xs sm:text-sm px-2 sm:px-3"
            size="sm"
            disabled={rateLimitCooldown > 0}
          >
            <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">New Campaign</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-6 pb-24 max-w-2xl mx-auto">
          {pageError && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-4">
              <div className="flex items-start gap-2">
                {rateLimitCooldown > 0 ? (
                  <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <p className="text-sm text-red-700">{pageError}</p>
              </div>
              <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => setPageError('')}><X className="w-4 h-4" /></Button>
            </motion.div>
          )}

          {rateLimitCooldown > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
              <Clock className="w-6 h-6 mx-auto mb-2 text-amber-600" />
              <p className="text-sm text-amber-800">
                Rate limit cooldown: <strong>{rateLimitCooldown} seconds</strong> remaining
              </p>
              <p className="text-xs text-amber-700 mt-1">Please wait before making more requests</p>
            </motion.div>
          )}

          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-xl shadow-lg border"
              >
                <CampaignForm
                  businessId={user?.business_id}
                  onCampaignUpdated={handleCampaignUpdated}
                  existingCampaign={selectedCampaign}
                  onCancel={handleFormClose}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {!showForm && (
            <div className="space-y-4">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                  {tabs.map(tab => (
                    <button
                      key={tab.name}
                      onClick={() => setActiveTab(tab.name.toLowerCase())}
                      className={`${
                        activeTab === tab.name.toLowerCase()
                          ? 'border-[var(--cashlap-blue)] text-[var(--cashlap-blue)]'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                    >
                      {tab.name}
                      <Badge variant={activeTab === tab.name.toLowerCase() ? 'default' : 'secondary'} className={`${activeTab === tab.name.toLowerCase() ? 'bg-[var(--cashlap-blue)] text-white' : 'bg-gray-100 text-gray-700'}`}>{tab.count}</Badge>
                    </button>
                  ))}
                </nav>
              </div>
              
              <div className="space-y-4">
                {tabs.find(t => t.name.toLowerCase() === activeTab)?.content}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Budget Increase Modal */}
      <AnimatePresence>
        {budgetModal.show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl p-6 w-full max-w-md"
            >
              <h3 className="text-lg font-semibold mb-4">Increase Campaign Budget</h3>
              <p className="text-gray-600 mb-4">
                Add more funds to "{budgetModal.campaign?.title}" campaign
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Current Budget</label>
                  <p className="text-2xl font-bold text-gray-900">${(budgetModal.campaign?.budget || 0).toFixed(2)}</p>
                </div>
                
                <div>
                  <label htmlFor="additional-budget-input" className="block text-sm font-medium mb-2">Additional Budget</label>
                  <Input
                    type="number"
                    placeholder="50.00"
                    min="1"
                    step="0.01"
                    id="additional-budget-input"
                    className="text-lg"
                  />
                </div>
                
                <div className="text-sm text-gray-500">
                  Your business balance: ${(user?.business_balance || 0).toFixed(2)}
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setBudgetModal({ show: false, campaign: null, loading: false })}
                  disabled={budgetModal.loading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    const input = document.getElementById('additional-budget-input');
                    const amount = parseFloat(input.value);
                    if (amount > 0) {
                      handleIncreaseBudget(budgetModal.campaign, amount);
                    } else {
                      toast.success('Please enter a valid amount');
                    }
                  }}
                  disabled={budgetModal.loading}
                  className="flex-1 bg-[var(--cashlap-blue)] hover:opacity-90"
                >
                  {budgetModal.loading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Add Budget
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CampaignManagerWrapper() { // Renamed the wrapper function to avoid conflict with internal component
  return (
    <AuthGuard
      requireAuth={true}
      requiredAccountType="business"
      requireBusinessId={true}
      fallbackUrl="Dashboard"
    >
      <CampaignManager />
    </AuthGuard>
  );
}