import { useState, useEffect } from 'react';
import { User, Business } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Briefcase, Save, Loader2, TrendingUp } from "lucide-react";

export default function BusinessInfoForm({ user, onProfileUpdate }) {
  const [businessProfile, setBusinessProfile] = useState({
    business_name: '',
    business_description: '',
    business_website: '',
    average_daily_traffic: ''
  });
  const [savingBusiness, setSavingBusiness] = useState(false);

  useEffect(() => {
    if (user) {
      setBusinessProfile({
        business_name: user.business_name || '',
        business_description: user.business_description || '',
        business_website: user.business_website || '',
        average_daily_traffic: user.average_daily_traffic ? String(user.average_daily_traffic) : ''
      });
    }
  }, [user]);

  const handleBusinessProfileChange = (field, value) => {
    setBusinessProfile(prev => ({...prev, [field]: value}));
  };

  const handleSaveBusinessProfile = async () => {
    setSavingBusiness(true);
    try {
        const updateData = {
            business_name: businessProfile.business_name,
            business_description: businessProfile.business_description,
            business_website: businessProfile.business_website,
            average_daily_traffic: businessProfile.average_daily_traffic ? parseFloat(businessProfile.average_daily_traffic) : undefined
        };
        await User.updateMyUserData(updateData);
        
        const existingBusinesses = await Business.filter({ business_owner_id: user.id }, '', 1);
        if (existingBusinesses.length > 0) {
            const businessToUpdate = existingBusinesses[0];
            const businessDataToUpdate = {
                name: businessProfile.business_name,
                description: businessProfile.business_description,
                website: businessProfile.business_website
            };
            await Business.update(businessToUpdate.id, businessDataToUpdate);
        }
        
        alert("Business profile updated!");
        if(onProfileUpdate) onProfileUpdate();

    } catch (error) {
        console.error("Error updating business profile:", error);
        alert("Failed to update profile. Please try again.");
    } finally {
        setSavingBusiness(false);
    }
  };

  return (
    <Card>
      <CardHeader className="p-4">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" />
          Business Information
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-4">
        <div>
          <label className="text-sm font-medium">Business Name</label>
          <Input
            value={businessProfile.business_name}
            onChange={(e) => handleBusinessProfileChange('business_name', e.target.value)}
            placeholder="Your business name"
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Website</label>
          <Input
            value={businessProfile.business_website}
            onChange={(e) => handleBusinessProfileChange('business_website', e.target.value)}
            placeholder="https://yourbusiness.com"
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Description</label>
          <Textarea
            value={businessProfile.business_description}
            onChange={(e) => handleBusinessProfileChange('business_description', e.target.value)}
            placeholder="A brief description of your business"
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[var(--cashlap-blue)]" />
            Average Daily Traffic (Baseline)
          </label>
          <Input
            type="number"
            value={businessProfile.average_daily_traffic}
            onChange={(e) => handleBusinessProfileChange('average_daily_traffic', e.target.value)}
            placeholder="e.g., 50"
            className="mt-1"
            min="0"
          />
          <p className="text-xs text-gray-500 mt-1">
            Enter your typical daily customer count to track CashLap's impact on your business
          </p>
        </div>
        <Button onClick={handleSaveBusinessProfile} disabled={savingBusiness} className="w-full sm:w-auto bg-[var(--cashlap-blue)] hover:opacity-90">
          {savingBusiness ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {savingBusiness ? 'Saving...' : 'Save Business Info'}
        </Button>
      </CardContent>
    </Card>
  );
}