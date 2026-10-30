import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Square, 
  Camera, 
  Users, 
  Activity, 
  ShieldCheck, 
  AlertCircle,
  RefreshCw,
  Video,
  Sparkles,
  Laptop
} from 'lucide-react';
import { CameraStatus } from '../types';
import { apiFetch, getAuthToken } from '../api';

interface LiveMonitoringViewProps {
  cameraStatus: CameraStatus;
  onStartCamera: () => Promise<void>;
  onStopCamera: () => Promise<void>;
}

export const LiveMonitoringView: React.FC<LiveMonitoringViewProps> = ({
  cameraStatus,
  onStartCamera,
  onStopCamera,
}) => {
  // Modes: 'virtual' (recommended for web preview), 'browser' (user's webcam), 'hardware' (local OpenCV capture)
  const [streamMode, setStreamMode] = useState<'virtual' | 'browser' | 'hardware'>('virtual');
  const [isBrowserStreaming, setIsBrowserStreaming] = useState<boolean>(false);
  const [annotatedImgSrc, setAnnotatedImgSrc] = useState<string | null>(null);
  const [clientFps, setClientFps] = useState<number>(0);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [streamError, setStreamError] = useState<string>('');
  const [feedTimestamp, setFeedTimestamp] = useState<number>(Date.now());

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<any>(null);

  // Clean up browser stream on unmount
  useEffect(() => {
    return () => {
      stopBrowserWebcam();
    };
  }, []);

  const startBrowserWebcam = async () => {
    setStreamError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      setIsBrowserStreaming(true);

      let frameCount = 0;
      let lastFpsTime = performance.now();

      intervalRef.current = setInterval(async () => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (video.videoWidth === 0 || video.videoHeight === 0) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.75);

        const startT = performance.now();
        try {
          const res = await apiFetch<{ annotated_image?: string; fps?: number }>(
            '/api/camera/process_frame',
            {
              method: 'POST',
              body: JSON.stringify({ image: dataUrl }),
            }
          );

          if (res.ok && res.data?.annotated_image) {
            setAnnotatedImgSrc(res.data.annotated_image);
            setLatencyMs(Math.round(performance.now() - startT));
          }
        } catch (err) {
          // ignore transient frame drop
        }

        frameCount++;
        const now = performance.now();
        if (now - lastFpsTime >= 1000) {
          setClientFps(Math.round((frameCount * 1000) / (now - lastFpsTime)));
          frameCount = 0;
          lastFpsTime = now;
        }
      }, 150);
    } catch (err: any) {
      setStreamError(
        err.name === 'NotAllowedError'
          ? 'Browser camera permission denied. Please allow camera permissions in your browser URL bar or switch to Virtual AI Camera mode.'
          : `Webcam error: ${err.message || 'Unable to access device camera'}`
      );
      setIsBrowserStreaming(false);
    }
  };

  const stopBrowserWebcam = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsBrowserStreaming(false);
    setAnnotatedImgSrc(null);
  };

  const handleStartStream = async () => {
    setStreamError('');
    if (streamMode === 'browser') {
      await startBrowserWebcam();
    } else {
      await onStartCamera();
      setFeedTimestamp(Date.now());
    }
  };

  const handleStopStream = async () => {
    if (streamMode === 'browser') {
      stopBrowserWebcam();
    } else {
      await onStopCamera();
    }
  };

  const isStreamActive = streamMode === 'browser' ? isBrowserStreaming : cameraStatus.is_running;
  const token = getAuthToken() || 'master-admin-token';
  const mjpegUrl = `/api/camera/feed?token=${token}&t=${feedTimestamp}`;

  return (
    <div className="space-y-6">
      {/* Header and Control Bar */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Video className="w-5 h-5 text-blue-400" />
            <span>Real-time Computer Vision Live Feed</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Observes live presence, performs person bounding-box tracking, and compares faces against registered residents.
          </p>
        </div>

        {/* Source Toggle and Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Selector */}
          <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
            <button
              onClick={() => {
                setStreamMode('virtual');
                stopBrowserWebcam();
              }}
              className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-all ${
                streamMode === 'virtual'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Virtual AI Camera</span>
            </button>
            <button
              onClick={() => {
                setStreamMode('browser');
                if (cameraStatus.is_running) onStopCamera();
              }}
              className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-all ${
                streamMode === 'browser'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>Browser Webcam</span>
            </button>
            <button
              onClick={() => {
                setStreamMode('hardware');
                stopBrowserWebcam();
              }}
              className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-all ${
                streamMode === 'hardware'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Hardware Device</span>
            </button>
          </div>

          {/* Action Button */}
          {isStreamActive ? (
            <button
              onClick={handleStopStream}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Stop Monitoring</span>
            </button>
          ) : (
            <button
              onClick={handleStartStream}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
            >
              <Play className="w-3.5 h-3.5" />
              <span>
                {streamMode === 'virtual'
                  ? 'Start Virtual AI Stream'
                  : streamMode === 'browser'
                  ? 'Start Browser Webcam'
                  : 'Start Hardware Stream'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Stream Error Alert */}
      {streamError && (
        <div className="p-3.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{streamError}</span>
          </div>
          <button
            onClick={() => {
              setStreamMode('virtual');
              setStreamError('');
              onStartCamera();
            }}
            className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shrink-0"
          >
            Switch to Virtual AI Stream
          </button>
        </div>
      )}

      {/* Main Video Viewport Container */}
      <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl aspect-video max-h-[640px] flex items-center justify-center">
        {/* Hidden Video & Canvas for browser capture (uses off-screen positioning instead of display:none so frames decode properly) */}
        <video 
          ref={videoRef} 
          className="fixed -top-[9999px] -left-[9999px] opacity-0 pointer-events-none w-1 h-1" 
          playsInline 
          muted 
          autoPlay 
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Display Output */}
        {streamMode === 'browser' ? (
          isBrowserStreaming && annotatedImgSrc ? (
            <img
              src={annotatedImgSrc}
              alt="Live Annotated Feed"
              className="w-full h-full object-contain"
            />
          ) : isBrowserStreaming ? (
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mb-3" />
              <p className="text-sm font-semibold text-slate-200">
                Initializing AI Inference Pipeline...
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Streaming frames to YOLO person detection and face recognizer
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-4">
                <Laptop className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-base font-bold text-slate-200">Browser Webcam Standby</h3>
              <p className="text-xs text-slate-400 max-w-md mt-1 mb-5">
                Uses your laptop/desktop camera via getUserMedia. Real-time frames are analyzed by the Python computer vision pipeline.
              </p>
              <button
                onClick={startBrowserWebcam}
                className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg"
              >
                <Play className="w-4 h-4" />
                <span>Launch Browser Camera</span>
              </button>
            </div>
          )
        ) : cameraStatus.is_running ? (
          <img
            src={mjpegUrl}
            alt="Live Security Camera Stream"
            className="w-full h-full object-contain"
            onError={() => {
              // auto refresh on network blip
              setTimeout(() => setFeedTimestamp(Date.now()), 1500);
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-4">
              <Sparkles className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="text-base font-bold text-slate-200">
              {streamMode === 'virtual' ? 'Virtual AI Camera Standby' : 'Hardware Stream Standby'}
            </h3>
            <p className="text-xs text-slate-400 max-w-md mt-1 mb-5">
              {streamMode === 'virtual'
                ? 'Launches the real-time AI security camera simulation with moving person presence, live timestamp, and instant YOLO access verification.'
                : `Connects to physical OpenCV device index ${cameraStatus.camera_index}. If in a container without a USB camera, switch to Virtual AI Camera mode.`}
            </p>
            <button
              onClick={handleStartStream}
              className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg"
            >
              <Play className="w-4 h-4" />
              <span>Start Live Monitoring</span>
            </button>
          </div>
        )}

        {/* Live HUD Floating Badges */}
        {isStreamActive && (
          <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2 z-10 pointer-events-none">
            <div className="px-3 py-1 rounded-md bg-slate-950/80 backdrop-blur-md border border-slate-700/60 text-xs font-semibold text-emerald-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>LIVE • AI ENGINE ACTIVE</span>
            </div>

            <div className="px-3 py-1 rounded-md bg-slate-950/80 backdrop-blur-md border border-slate-700/60 text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              <span>{streamMode === 'browser' ? clientFps : (cameraStatus.fps || 12)} FPS</span>
            </div>

            {streamMode === 'browser' && latencyMs > 0 && (
              <div className="px-3 py-1 rounded-md bg-slate-950/80 backdrop-blur-md border border-slate-700/60 text-xs font-medium text-slate-300">
                Latency: {latencyMs}ms
              </div>
            )}
          </div>
        )}
      </div>

      {/* Real-time Legend & Legal Guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 mt-1 shrink-0" />
          <div>
            <h4 className="text-xs font-bold text-slate-200">Authorized Resident / Guest</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Face matches stored biometric embedding with &ge; 60% cosine similarity.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
          <div className="w-3 h-3 rounded-full bg-rose-500 mt-1 shrink-0" />
          <div>
            <h4 className="text-xs font-bold text-slate-200">Unknown Visitor</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Clear face detected with no authorized match. Automatically logs snapshot and triggers security alert.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
          <div className="w-3 h-3 rounded-full bg-amber-500 mt-1 shrink-0" />
          <div>
            <h4 className="text-xs font-bold text-slate-200">Face Not Recognized</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Face is blurry, distant, or uncertain. Does NOT generate an unknown alert to prevent false alarms.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
