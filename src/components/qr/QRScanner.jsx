
import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { validateAndProcessCheckIn } from '@/functions/validateAndProcessCheckIn';
import { X, Camera, AlertTriangle, Loader2, RefreshCw, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function QRScanner({ campaign, user, onCheckInSuccess, onClose }) {
  const [status, setStatus] = useState('initializing'); // initializing -> requesting_location -> requesting_camera -> scanning -> processing -> error
  const [error, setError] = useState('');
  const [userLocation, setUserLocation] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameId = useRef(null);

  const cleanup = useCallback(() => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const handleQRDetected = useCallback(async (qrData) => {
    // Stop the scanning process immediately
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    
    setStatus('processing');
    
    if (!userLocation) {
      setError('Location data was lost. Please try again.');
      setStatus('error');
      return;
    }
    
    try {
      const result = await validateAndProcessCheckIn({
        qrData,
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      });
      
      if (result.data?.success && result.data.mission) {
        onCheckInSuccess(result.data.mission);
      } else {
        setError(result.data?.error || 'Check-in failed. Please try again.');
        setStatus('error');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'A server error occurred during check-in.');
      setStatus('error');
    }
  }, [userLocation, onCheckInSuccess]);

  const scanLoop = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !window.jsQR) {
        animationFrameId.current = requestAnimationFrame(scanLoop);
        return;
    }

    const video = videoRef.current;
    if (video.readyState < 2) { // Need at least metadata to get dimensions (HAVE_METADATA = 2)
      animationFrameId.current = requestAnimationFrame(scanLoop);
      return;
    }

    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    if (canvas.width === 0 || canvas.height === 0) {
        animationFrameId.current = requestAnimationFrame(scanLoop);
        return;
    }

    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    
    const qrCode = window.jsQR(imageData.data, canvas.width, canvas.height, {
      inversionAttempts: "dontInvert",
    });

    if (qrCode && qrCode.data) {
      handleQRDetected(qrCode.data);
    } else {
      animationFrameId.current = requestAnimationFrame(scanLoop);
    }
  }, [handleQRDetected]);

  useEffect(() => {
    const requestLocation = () => {
      if (!navigator.geolocation) {
        setError('Geolocation is not supported by your browser.');
        setStatus('error');
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setStatus('requesting_camera');
        },
        (err) => {
          let msg = "Location permission denied. You must enable location services to check in.";
          if (err.code === 2) msg = "Could not determine your location. Check network and GPS.";
          setError(msg);
          setStatus('error');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    };

    const startCamera = async () => {
      if (!videoRef.current) return;
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        
        // This is the key change: we start the scan loop directly from the 'onplaying' event.
        videoRef.current.onplaying = () => {
          setStatus('scanning');
          // Guard against multiple calls
          if (!animationFrameId.current) {
            animationFrameId.current = requestAnimationFrame(scanLoop);
          }
        };

        // The 'play' call triggers the browser to get the stream and eventually fire 'onplaying'
        await videoRef.current.play();
        
      } catch (err) {
        console.error('Camera error:', err);
        let msg = 'Camera access denied. Please enable it in your browser settings.';
        if (err.name === 'NotFoundError') msg = 'No camera found on this device.';
        setError(msg);
        setStatus('error');
      }
    };

    const loadJsQR = () => {
      if (window.jsQR) {
        setStatus('requesting_location');
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
      script.onload = () => setStatus('requesting_location');
      script.onerror = () => {
        setError('Failed to load QR scanner library.');
        setStatus('error');
      };
      document.head.appendChild(script);
    };

    switch (status) {
      case 'initializing':
        loadJsQR();
        break;
      case 'requesting_location':
        requestLocation();
        break;
      case 'requesting_camera':
        startCamera();
        break;
      // The 'scanning' case is now handled by the onplaying event, so it's removed from here.
      case 'error':
      case 'processing':
        cleanup(); // Ensure everything stops on final states.
        break;
      default:
        break;
    }

  }, [status, scanLoop, cleanup]);

  const handleRetry = () => {
    setError('');
    setStatus('initializing');
  };

  const renderStatus = () => {
    switch(status) {
      case 'error':
        return (
          <>
            <AlertTriangle className="w-8 h-8 mb-2 text-red-400" />
            <p className="text-sm mb-4">{error}</p>
            <Button onClick={handleRetry} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </>
        );
      case 'processing':
        return (
          <>
            <Loader2 className="w-8 h-8 animate-spin mb-2" />
            <p>Verifying check-in...</p>
          </>
        );
      case 'scanning':
         return (
          <>
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mb-2">
              <Camera className="w-4 h-4 text-white" />
            </div>
            <p>Point camera at QR code</p>
          </>
        );
      default:
        return (
          <>
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p className="text-sm">
              {status === 'initializing' && 'Loading scanner...'}
              {status === 'requesting_location' && 'Getting your location...'}
              {status === 'requesting_camera' && 'Starting camera...'}
            </p>
          </>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-[9999] p-4"
    >
      <Card className="w-full max-w-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg">Scan QR Code</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        
        <CardContent className="p-4">
          <div className="relative aspect-square bg-black rounded-lg overflow-hidden mb-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ opacity: status === 'scanning' || status === 'processing' ? 1 : 0 }}
            />
            
            <AnimatePresence>
              {(status !== 'scanning' && status !== 'processing') && (
                <motion.div
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center text-white p-4 text-center"
                >
                  {renderStatus()}
                </motion.div>
              )}
            </AnimatePresence>
             {status === 'scanning' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-2/3 h-2/3 border-4 border-white/50 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
                </div>
            )}
          </div>
          
          <div className="flex items-center justify-center text-sm text-gray-600">
            <MapPin className="w-4 h-4 mr-2 text-blue-500"/>
            <p>Location required for check-in</p>
          </div>
        </CardContent>
      </Card>
      
      <canvas ref={canvasRef} className="hidden" />
    </motion.div>
  );
}
