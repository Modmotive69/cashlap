import { useState, useEffect } from 'react';
import { User, Referral } from '@/entities/all';
import { SendEmail } from '@/integrations/Core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Gift, 
  Share2, 
  Copy, 
  QrCode, 
  Users, 
  DollarSign, 
  Check,
  Send,
  Loader2,
  Star
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function ReferralCard({ user, onUpdate }) {
  const [referralCode, setReferralCode] = useState('');
  const [referrals, setReferrals] = useState([]);
  const [emailAddress, setEmailAddress] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);

  useEffect(() => {
    initializeReferralCode();
    loadReferrals();
  }, [user]);

  const initializeReferralCode = async () => {
    if (user.referral_code) {
      setReferralCode(user.referral_code);
    } else {
      // Generate a unique referral code
      const code = generateReferralCode();
      await User.updateMyUserData({ referral_code: code });
      setReferralCode(code);
      if (onUpdate) onUpdate();
    }
  };

  const generateReferralCode = () => {
    const userName = (user.full_name || user.email || 'USER').replace(/\s+/g, '').toUpperCase();
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${userName.substring(0, 4)}${randomSuffix}`;
  };

  const loadReferrals = async () => {
    try {
      const userReferrals = await Referral.filter({ referrer_id: user.id });
      setReferrals(userReferrals);
    } catch (error) {
      console.error('Error loading referrals:', error);
    }
  };

  const getReferralLink = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}?ref=${referralCode}`;
  };

  const copyReferralLink = async () => {
    try {
      await navigator.clipboard.writeText(getReferralLink());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const sendReferralEmail = async () => {
    if (!emailAddress.trim()) {
      alert('Please enter an email address');
      return;
    }

    setIsSendingEmail(true);
    try {
      const referralLink = getReferralLink();
      const accountTypeText = user.account_type === 'business' ? 'business owner' : 'player';
      
      await SendEmail({
        to: emailAddress.trim(),
        subject: `${user.full_name || 'Your friend'} invited you to join CashLap!`,
        body: `
Hi there!

${user.full_name || 'Your friend'} has invited you to join CashLap, the platform where you can earn money by engaging with local businesses!

🎁 Special Offer: When you sign up and complete your first campaign, you'll both receive $10!

Join CashLap now: ${referralLink}

How it works:
${user.account_type === 'business' ? 
  '• Create campaigns to attract customers to your business\n• Track engagement and analyze results\n• Build your local customer base' :
  '• Discover local businesses and campaigns\n• Complete fun challenges and earn rewards\n• Get paid for your engagement'
}

Don't miss out on this opportunity to start earning with CashLap!

Best regards,
The CashLap Team
        `
      });

      setEmailAddress('');
      alert('Referral email sent successfully!');
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send email. Please try again.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const generateQRCodeURL = () => {
    const referralLink = getReferralLink();
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(referralLink)}`;
  };

  const shareReferralLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join CashLap and earn $10!',
          text: `Join me on CashLap and we'll both earn $10 when you complete your first campaign!`,
          url: getReferralLink()
        });
      } catch (error) {
        console.error('Error sharing:', error);
        copyReferralLink();
      }
    } else {
      copyReferralLink();
    }
  };

  const completedReferrals = referrals.filter(r => r.status === 'completed' || r.status === 'rewarded');
  const totalEarned = completedReferrals.length * 10;

  return (
    <Card>
      <CardHeader className="p-4">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Gift className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--cashlap-pink)]" />
          Referral Program
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-4">
        <div className="bg-gradient-to-r from-[var(--cashlap-pink)]/10 to-[var(--cashlap-yellow)]/10 p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-5 h-5 text-[var(--cashlap-yellow)]" />
            <p className="font-semibold text-gray-900">Earn $10 for Each Friend!</p>
          </div>
          <p className="text-sm text-gray-600">
            When your friends join CashLap using your code and complete their first campaign, you both receive $10!
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <Users className="w-6 h-6 mx-auto mb-2 text-[var(--cashlap-blue)]" />
            <p className="text-xl font-bold text-gray-900">{completedReferrals.length}</p>
            <p className="text-xs text-gray-500">Successful Referrals</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <DollarSign className="w-6 h-6 mx-auto mb-2 text-[var(--cashlap-green)]" />
            <p className="text-xl font-bold text-gray-900">${totalEarned}</p>
            <p className="text-xs text-gray-500">Referral Earnings</p>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-800 mb-2">Your Referral Code</p>
          <div className="flex gap-2">
            <div className="flex-1 p-3 bg-gray-100 rounded-lg font-mono text-center">
              <span className="text-lg font-bold text-[var(--cashlap-blue)]">{referralCode}</span>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={copyReferralLink}
              className="flex-shrink-0"
            >
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-800 mb-2">Invite via Email</p>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="friend@example.com"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              className="flex-1"
              disabled={isSendingEmail}
            />
            <Button
              onClick={sendReferralEmail}
              disabled={isSendingEmail || !emailAddress.trim()}
              className="bg-[var(--cashlap-blue)] hover:opacity-90 flex-shrink-0"
            >
              {isSendingEmail ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowQRCode(!showQRCode)}
            className="flex-1"
          >
            <QrCode className="w-4 h-4 mr-2" />
            {showQRCode ? 'Hide QR Code' : 'Show QR Code'}
          </Button>
          <Button
            variant="outline"
            onClick={shareReferralLink}
            className="flex-1"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share Link
          </Button>
        </div>

        {showQRCode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="text-center"
          >
            <img
              src={generateQRCodeURL()}
              alt="Referral QR Code"
              className="mx-auto rounded-lg shadow-md"
            />
            <p className="text-xs text-gray-500 mt-2">Scan to join with your referral code</p>
          </motion.div>
        )}

        {referrals.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-800 mb-2">Recent Referrals</p>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {referrals.slice(0, 5).map((referral) => (
                <div key={referral.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      {referral.status === 'completed' || referral.status === 'rewarded' ? 'Friend joined & engaged' : 'Friend joined'}
                    </span>
                  </div>
                  <Badge
                    variant={referral.status === 'completed' || referral.status === 'rewarded' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {referral.status === 'completed' || referral.status === 'rewarded' ? '+$10' : 'Pending'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}