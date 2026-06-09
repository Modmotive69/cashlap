
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { QRCode } from '@/entities/all';
import { QrCode, Download, MapPin, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function QRCodeGenerator({ campaign, user }) {
  const [qrCodes, setQrCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedLocationIndex, setSelectedLocationIndex] = useState(null);

  const loadQRCodes = useCallback(async () => {
    try {
      const codes = await QRCode.filter({ campaign_id: campaign.id }, '-created_date');
      setQrCodes(codes);
    } catch (error) {
      console.error('Error loading QR codes:', error);
    } finally {
      setLoading(false);
    }
  }, [campaign.id]);

  useEffect(() => {
    loadQRCodes();
  }, [loadQRCodes]);

  const generateQRCode = async () => {
    if (selectedLocationIndex === null || selectedLocationIndex === undefined) {
      toast.success('Please select a verified location for this QR code.');
      return;
    }

    const selectedLocation = campaign.locations[selectedLocationIndex];
    if (!selectedLocation || !selectedLocation.latitude || !selectedLocation.longitude) {
      toast.success('The selected location is not verified. Please verify it in the campaign editor.');
      return;
    }

    setGenerating(true);
    try {
      // Each QR code is given a unique ID for security and tracking.
      const uniqueData = `cashlap_${campaign.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // The new QR Code is automatically and securely linked to the correct campaign and business.
      const newQRCode = await QRCode.create({
        campaign_id: campaign.id,
        business_id: user.business_id,
        qr_code_data: uniqueData,
        location_name: selectedLocation.address,
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        status: 'active'
      });

      setQrCodes([newQRCode, ...qrCodes]);
      setSelectedLocationIndex(null); // Reset selected location after generation
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast.error('Failed to generate QR code. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const toggleQRCodeStatus = async (qrCodeId, currentStatus) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      await QRCode.update(qrCodeId, { status: newStatus });
      
      setQrCodes(qrCodes.map(qr => 
        qr.id === qrCodeId ? { ...qr, status: newStatus } : qr
      ));
    } catch (error) {
      console.error('Error updating QR code status:', error);
      toast.error('Failed to update QR code status.');
    }
  };

  const deleteQRCode = async (qrCodeId) => {
    if (!window.confirm('Are you sure you want to delete this QR code? This cannot be undone.')) {
      return;
    }

    try {
      await QRCode.delete(qrCodeId);
      setQrCodes(qrCodes.filter(qr => qr.id !== qrCodeId));
    } catch (error) {
      console.error('Error deleting QR code:', error);
      toast.error('Failed to delete QR code.');
    }
  };

  const downloadQRCode = async (qrCodeData, locationName) => {
    // Create QR code URL for download as JPEG
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeData)}&format=jpg`;
    
    try {
      const response = await fetch(qrUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch QR code image from the server.');
      }
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `QR_${locationName.replace(/[^a-zA-Z0-9]/g, '_')}_${campaign.title.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('QR Code download failed:', error);
      toast.error('Could not download the QR code. Please check your internet connection and try again.');
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-[var(--cashlap-blue)] border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-sm sm:text-base">Loading QR codes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900">QR Code Manager</h3>
        <p className="text-xs sm:text-sm text-gray-500">Generate and manage check-in codes for this campaign.</p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Select
            value={selectedLocationIndex !== null ? String(selectedLocationIndex) : ""}
            onValueChange={(value) => setSelectedLocationIndex(value === "" ? null : Number(value))}
          >
            <SelectTrigger className="flex-grow text-sm sm:text-base">
              <SelectValue placeholder="Select a verified campaign location" />
            </SelectTrigger>
            <SelectContent>
              {campaign.locations && campaign.locations.map((location, index) => (
                (location.latitude && location.longitude) ? (
                  <SelectItem key={index} value={String(index)}>
                    {location.address}
                  </SelectItem>
                ) : null
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={generateQRCode}
            disabled={generating || selectedLocationIndex === null}
            className="bg-[var(--cashlap-blue)] hover:opacity-90 w-full sm:w-auto"
          >
            {generating ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                Generating...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Generate
              </>
            )}
          </Button>
        </div>

        {qrCodes.length === 0 ? (
          <div className="text-center py-8">
            <QrCode className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500 mb-2 text-sm sm:text-base">No QR codes generated yet</p>
            <p className="text-xs sm:text-sm text-gray-400">Create your first QR code to enable player check-ins</p>
          </div>
        ) : (
          <div className="space-y-3 border-t border-gray-200 pt-4 mt-4">
            {qrCodes.map((qrCode, index) => (
              <motion.div
                key={qrCode.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`p-3 sm:p-4 border rounded-lg ${
                  qrCode.status === 'active' ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <h4 className="font-medium text-gray-900 text-sm sm:text-base truncate">{qrCode.location_name}</h4>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium w-fit ${
                        qrCode.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {qrCode.status}
                      </span>
                    </div>
                    
                    <div className="text-xs sm:text-sm text-gray-600 space-y-1 mb-3">
                      <p>Scans: <span className="font-medium">{qrCode.total_scans || 0}</span></p>
                      {qrCode.last_scanned && (
                        <p>Last scanned: <span className="font-medium">{new Date(qrCode.last_scanned).toLocaleString()}</span></p>
                      )}
                    </div>
                    
                    <div className="bg-gray-100 p-2 rounded text-xs font-mono break-all">
                      {qrCode.qr_code_data}
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center gap-3 sm:flex-shrink-0">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(qrCode.qr_code_data)}`}
                      alt="QR Code"
                      className="w-16 h-16 sm:w-20 sm:h-20 border rounded"
                    />
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-4 pt-3 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadQRCode(qrCode.qr_code_data, qrCode.location_name)}
                    className="w-full sm:w-auto text-xs sm:text-sm"
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleQRCodeStatus(qrCode.id, qrCode.status)}
                    className="w-full sm:w-auto text-xs sm:text-sm"
                  >
                    {qrCode.status === 'active' ? (
                      <>
                        <EyeOff className="w-3 h-3 mr-1" />
                        Deactivate
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3 mr-1" />
                        Activate
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteQRCode(qrCode.id)}
                    className="w-full sm:w-auto text-red-600 hover:text-red-700 hover:bg-red-50 text-xs sm:text-sm"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
