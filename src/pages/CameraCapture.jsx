
import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Mission, Campaign, User, Business } from "@/entities/all";
import { UploadFile } from "@/integrations/Core";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Camera,
  ArrowLeft,
  Send,
  Loader2,
  Star,
  Video,
  Square,
  X,
  AlertTriangle
} from "lucide-react";
import { createPageUrl } from "@/utils";
import SuccessModal from "@/components/mission/SuccessModal";
import { motion, AnimatePresence } from "framer-motion";
import { completeMission } from '@/functions/completeMission';
import { sanitize } from '@/components/utils/sanitizer';
import { analytics } from '@/lib/analytics';
import { captureError } from '@/lib/sentry';

export default function CameraCapture() {
  const [mission, setMission] = useState(null);
  const [campaign, setCampaign] = useState(null);
  const [business, setBusiness] = useState(null);
  const [user, setUser] = useState(null);
  const [mediaFile, setMediaFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [reviewText, setReviewText] = useState("");
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false); // Renamed from submitting to isSubmitting in outline, but keeping 'submitting' for consistency with `processingSubmission`
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState('capture');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaType, setMediaType] = useState('photo');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [error, setError] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);
  const [stream, setStream] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [cameraZoom, setCameraZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [lastTouchDistance, setLastTouchDistance] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      // Debounce to prevent rapid calls
      const now = Date.now();
      const lastLoadTime = localStorage.getItem('cameracapture_last_load');
      if (lastLoadTime && (now - parseInt(lastLoadTime)) < 2000) {
        console.log('CameraCapture load called too frequently, skipping...');
        return;
      }
      localStorage.setItem('cameracapture_last_load', now.toString());

      setLoading(true);
      setError('');
      try {
        let missionData, campaignData, businessData;

        if (location.state?.mission && location.state?.campaign) {
          missionData = location.state.mission;
          campaignData = location.state.campaign;
          businessData = location.state.business;
        } else {
          const urlParams = new URLSearchParams(location.search);
          const missionId = urlParams.get("missionId");
          const campaignId = urlParams.get("campaignId");

          if (!missionId || !campaignId) {
            navigate(createPageUrl('Dashboard'));
            return;
          }

          [missionData, campaignData] = await Promise.all([
            Mission.get(missionId),
            Campaign.get(campaignId)
          ]);

          businessData = await Business.get(missionData.business_id);
        }

        const userData = await User.me();
        
        setMission(missionData);
        setCampaign(campaignData);
        setBusiness(businessData);
        setUser(userData);

      } catch (err) {
        console.error("Error loading initial data:", err);
        setError(`Failed to load mission details: ${err.message}. Please go back and try again.`);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [location, navigate]);

  useEffect(() => {
    if (currentStep === 'capture') {
      startCamera();
    }

    return () => {
      stopCamera();
    };
  }, [currentStep]);

  const startCamera = async () => {
    if (videoRef.current && videoRef.current.srcObject) {
      return;
    }
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: true
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError('');
    } catch (err) {
      console.error("Camera error:", err);
      setError("Failed to access camera. Please ensure camera permissions are granted and no other app is using it.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const currentStream = videoRef.current.srcObject;
      currentStream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setStream(null);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    setIsRecording(false);
    setRecordingTime(0);
    setCameraZoom(1);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    canvas.width = videoWidth;
    canvas.height = videoHeight;

    const sourceX = (videoWidth - videoWidth / cameraZoom) / 2;
    const sourceY = (videoHeight - videoHeight / cameraZoom) / 2;
    const sourceWidth = videoWidth / cameraZoom;
    const sourceHeight = videoHeight / cameraZoom;

    context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "photo.jpg", { type: "image/jpeg" });
        setMediaFile(file);
        setPreview(URL.createObjectURL(file));
        setCurrentStep('review');
        stopCamera();
        setError('');
      } else {
        setError("Failed to capture photo. Please try again.");
      }
    }, "image/jpeg", 0.9);
  };

  const startRecording = () => {
    if (!stream) {
      setError("No camera stream available to start recording.");
      return;
    }

    try {
      let mimeType = '';
      if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) {
        mimeType = 'video/webm;codecs=h264';
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        mimeType = 'video/webm';
      } else {
        console.warn('No supported video format found');
        setError("Your device does not support recording video in a compatible format.");
        return;
      }

      const recorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        videoBitsPerSecond: 2500000
      });

      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        if (recordedChunksRef.current.length > 0) {
          const blob = new Blob(recordedChunksRef.current, {
            type: mimeType
          });

          const file = new File([blob], `video.${mimeType.split('/')[1].split(';')[0]}`, {
            type: mimeType
          });

          setMediaFile(file);

          const previewUrl = URL.createObjectURL(blob);
          setPreview(previewUrl);
          setCurrentStep('review');
          recordedChunksRef.current = [];
          stopCamera();
          setError('');
        } else {
          setError("No video data was recorded. Please try again.");
        }
      };

      recorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (recordError) {
      console.error("Recording error:", recordError);
      setError(`Failed to start recording: ${recordError.message}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      clearInterval(recordingIntervalRef.current);
      setIsRecording(false);
    }
  };

  const handleRetake = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    setMediaFile(null);
    setPreview(null);
    setReviewText("");
    setRating(0);
    setCurrentStep('capture');
    setError('');
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    navigate(createPageUrl('Dashboard'));
  };

  // Renamed from handleSubmit to handleMissionSubmission as per outline
  const handleMissionSubmission = async () => {
    if (!mediaFile) {
      setError("Please capture a photo or video before submitting.");
      return;
    }
    if (submitting) return; // Prevent double submission

    setSubmitting(true);
    setError('');
    
    try {
      const { file_url: uploadedMediaUrl } = await UploadFile({ file: mediaFile });
      console.log("Uploaded media URL:", uploadedMediaUrl);

      if (!mission?.id || !user?.id) {
        throw new Error("Mission or user data is missing for completion.");
      }

      // Prepare data to send to the completeMission function
      const submissionDetails = {
        missionId: mission.id,
        userId: user.id,
        businessId: business?.id,
        campaignId: campaign?.id,
        photo_url: uploadedMediaUrl,
        social_post_url: null, // As social media share is not part of this flow for this component
        review_text: sanitize(reviewText), // Sanitize text inputs before submission
        rating: rating || 5, // Default to 5 stars if not set
        userTotalFollowers: user.total_followers,
        userTotalEarnings: user.total_earnings,
        userMissionsCompleted: user.missions_completed,
        userExperiencePoints: user.experience_points,
        userLevel: user.level,
        missionRewardAmount: mission.reward_amount,
        missionTitle: mission.title,
        businessTotalVisits: business?.total_visits,
        businessRating: business?.rating,
        campaignCurrentParticipants: campaign?.current_participants,
      };

      // Call the external completeMission function to handle all backend logic
      const response = await completeMission(submissionDetails);

      if (response.success) {
        analytics.missionSubmitted(mission?.id, mission?.reward_amount);
        setSubmittedData({
          reward: response.reward,
          xpGained: response.xpGained,
          leveledUp: response.leveledUp,
          newLevel: response.newLevel,
          missionTitle: response.missionTitle
        });
        setShowSuccessModal(true);
      } else {
        throw new Error(response.error || 'Failed to complete mission.');
      }

    } catch (err) {
      captureError(err, { context: 'CameraCapture.handleMissionSubmission', missionId: mission?.id });
      setError(`Submission failed: ${err.message}. Please check your connection and try again.`);
    } finally {
      setSubmitting(false);
      }
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.pageX - touch1.pageX, 2) +
        Math.pow(touch2.pageY - touch1.pageY, 2)
      );
      setLastTouchDistance(distance);
      setIsDragging(true);
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && isDragging) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.pageX - touch1.pageX, 2) +
        Math.pow(touch2.pageY - touch1.pageY, 2)
      );

      if (lastTouchDistance > 0) {
        const ratio = distance / lastTouchDistance;
        const newZoom = Math.max(1, Math.min(3, cameraZoom * ratio));
        setCameraZoom(newZoom);
      }

      setLastTouchDistance(distance);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setLastTouchDistance(0);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="w-full h-screen bg-gray-900 flex flex-col items-center justify-center p-4 text-white">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        <p>Loading Mission...</p>
      </div>
    );
  }

  if (error && !mission) {
    return (
      <div className="w-full h-screen bg-gray-900 flex flex-col items-center justify-center p-4 text-white text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">Error</h2>
        <p className="mb-4">{error}</p>
        <Button onClick={() => navigate(createPageUrl('Dashboard'))} variant="secondary">Go to Dashboard</Button>
      </div>
    );
  }
  
  if (!mission || !campaign) return null;

  return (
    <div className="fixed inset-0 bg-black">
      <AnimatePresence>
        {showSuccessModal && submittedData && (
          <SuccessModal
            reward={submittedData.reward}
            xpGained={submittedData.xpGained}
            leveledUp={submittedData.leveledUp}
            newLevel={submittedData.newLevel}
            mission={mission}
            business={business}
            onClose={handleSuccessModalClose}
          />
        )}
      </AnimatePresence>

      {currentStep === 'capture' && (
        <>
          <div
            className="absolute inset-0"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ touchAction: 'none' }}
          >
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              style={{
                transform: `scale(${cameraZoom})`,
                transformOrigin: 'center',
                transition: isDragging ? 'none' : 'transform 0.1s ease'
              }}
              playsInline
              muted
              autoPlay
            />
            <canvas ref={canvasRef} className="hidden" />
          </div>

          <div className="absolute top-0 left-0 right-0 z-20 bg-black/30 backdrop-blur-sm">
            <div className="flex items-center justify-between p-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(createPageUrl('Dashboard'))}
                className="text-white hover:bg-white/20"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>

              {cameraZoom > 1 && (
                <div className="bg-black/50 px-2 py-1 rounded text-white text-sm">
                  {cameraZoom.toFixed(1)}x
                </div>
              )}

              <div className="w-10" />
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 z-20 bg-black/30 backdrop-blur-sm pb-8">
            {isRecording && (
              <div className="text-center py-2">
                <div className="inline-flex items-center gap-2 bg-red-500 px-3 py-1 rounded-full">
                  <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                  <span className="text-white font-mono text-sm">
                    {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-center gap-8 px-8 py-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMediaType(mediaType === 'video' ? 'photo' : 'video')}
                className={`text-white px-3 py-1 rounded-full text-sm ${
                  mediaType === 'video' ? 'bg-red-500' : 'bg-white/20'
                }`}
              >
                {mediaType === 'video' ? 'Video' : 'Photo'}
              </Button>

              <Button
                onClick={mediaType === 'video' ? (isRecording ? stopRecording : startRecording) : capturePhoto}
                className={`w-20 h-20 rounded-full border-4 border-white ${
                  isRecording
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-white/20 hover:bg-white/30'
                }`}
              >
                {mediaType === 'video' ? (
                  isRecording ? (
                    <Square className="w-8 h-8 text-white" />
                  ) : (
                    <Video className="w-8 h-8 text-white" />
                  )
                ) : (
                  <Camera className="w-8 h-8 text-white" />
                )}
              </Button>

              {cameraZoom > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCameraZoom(1);
                  }}
                  className="text-white px-3 py-1 rounded-full text-sm bg-white/20"
                >
                  1x
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      {currentStep === 'review' && (
        <div className="flex flex-col h-full bg-gray-100 relative">
          <div className="bg-white shadow-sm p-4 flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                handleRetake();
              }}
              className="flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </Button>
            <h2 className="font-semibold">Review & Submit</h2>
          </div>

          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            <div className="bg-black rounded-lg overflow-hidden">
              {preview && (
                mediaFile?.type.startsWith('video/') ? (
                  <video
                    src={preview}
                    className="w-full h-64 object-contain"
                    controls
                    playsInline
                    preload="metadata"
                    onError={(e) => {
                      console.error('Video error:', e.target.error);
                      setError('Failed to load video preview.');
                    }}
                    onCanPlay={() => {
                      console.log('Video can play');
                    }}
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full h-64 object-cover"
                  />
                )
              )}
            </div>

            <Textarea
              placeholder="Add a comment about your experience..."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              className="min-h-20"
            />

            <div className="flex items-center gap-2">
              <span className="text-sm">Rate:</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Button
                    key={star}
                    variant="ghost"
                    size="sm"
                    onClick={() => setRating(star)}
                    className="p-1"
                  >
                    <Star
                      className={`w-6 h-6 ${
                        star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                      }`}
                    />
                  </Button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleMissionSubmission} // Updated to use the new function name
              disabled={!mediaFile || submitting || processingSubmission}
              className="w-full bg-[#1E90FF] hover:bg-[#1E90FF]/90 text-white h-12"
            >
              {(submitting || processingSubmission) ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit Mission
                </>
              )}
            </Button>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center p-4 z-50 text-center"
            >
              <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Submission Failed</h3>
              <p className="text-white text-center mb-4">{error}</p>
              <Button onClick={() => setError('')}>Try Again</Button>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
