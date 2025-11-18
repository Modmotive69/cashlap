
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AuthGuard from '@/components/auth/AuthGuard';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';

function PaymentSuccessContent() {
    const [isRedirecting, setIsRedirecting] = useState(false);
    const navigate = useNavigate();

    const handleGoToDashboard = () => {
        setIsRedirecting(true);
        // Simulate a slight delay for better UX before redirecting
        setTimeout(() => {
            navigate(createPageUrl('Dashboard') + '?payment_success=true');
        }, 500); // 500ms delay before redirect
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center"
            >
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                    className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
                >
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                </motion.div>

                <h1 className="text-2xl font-bold text-gray-900 mb-4">
                    Payment Successful!
                </h1>
                
                <p className="text-gray-600 mb-8">
                    Your funds have been added to your business account. You can now use them to create and manage campaigns.
                </p>

                <Button
                    onClick={handleGoToDashboard}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 text-base"
                    disabled={isRedirecting}
                >
                    {isRedirecting ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Redirecting...
                        </>
                    ) : (
                        "Go to Dashboard"
                    )}
                </Button>
            </motion.div>
        </div>
    );
}

export default function PaymentSuccess() {
    return (
        <AuthGuard requireAuth={true} requiredAccountType="business" fallbackUrl="Dashboard">
            <PaymentSuccessContent />
        </AuthGuard>
    );
}
