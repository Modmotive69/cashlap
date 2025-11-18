
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, Lock, Server, FileCheck2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import AuthGuard from "@/components/auth/AuthGuard";

function SecurityContent() {
  return (
    <div className="p-4 sm:p-6 space-y-6 pb-24">
      <div className="text-center">
        <ShieldCheck className="w-16 h-16 mx-auto text-[var(--cashlap-green)] mb-4" />
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Security & Privacy</h1>
        <p className="text-gray-600 mt-2 text-base sm:text-lg">Your trust and data security are our top priority.</p>
      </div>

      <Card className="border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl">
            <FileCheck2 className="w-6 h-6 text-purple-600" />
            <span>Input Validation &amp; Sanitization</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-base text-gray-700">
          <p>
            All data submitted through forms is rigorously validated and sanitized before being stored. We automatically remove any potentially malicious code (like HTML or JavaScript tags) from your input.
          </p>
          <p>
            This proactive approach, combined with modern framework protections, prevents common web vulnerabilities like <strong>Cross-Site Scripting (XSS)</strong> and ensures the integrity of the data in our system.
          </p>
        </CardContent>
      </Card>

      <Card className="border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl">
            <Lock className="w-6 h-6 text-[var(--cashlap-blue)]" />
            <span>Encryption in Transit</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-base text-gray-700">
          <p>
            Every piece of data you send to or receive from the CashLap app is protected using industry-standard <strong>HTTPS with TLS 1.2/1.3 encryption.</strong>
          </p>
          <p>
            This means all your interactions, from logging in to completing a mission, are securely encrypted and cannot be read by third parties while in transit over the internet.
          </p>
        </CardContent>
      </Card>

      <Card className="border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl">
            <Server className="w-6 h-6 text-[var(--cashlap-orange)]" />
            <span>Encryption at Rest</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-base text-gray-700">
          <p>
            Once your data reaches our servers, it is stored in a secure database that employs <strong>256-bit AES disk-level encryption.</strong>
          </p>
          <p>
            This foundational security layer ensures that your saved information, including your profile details and mission history, is protected and unreadable on the physical storage media.
          </p>
        </CardContent>
      </Card>

      <Card className="border-gray-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl">
            <ShieldCheck className="w-6 h-6 text-[var(--cashlap-green)]" />
            <span>Our Commitment</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-base text-gray-700">
          <p>
            We are committed to using best practices and leveraging the robust security features of our platform to keep your data safe. We continuously monitor and update our systems to protect against emerging threats.
          </p>
        </CardContent>
      </Card>
      
      <div className="text-center mt-6">
        <Link to={createPageUrl("Dashboard")}>
          <Button variant="outline" className="text-base">
            Back to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function Security() {
  return (
    <AuthGuard requireAuth={true} fallbackUrl="Onboarding">
      <SecurityContent />
    </AuthGuard>
  );
}
