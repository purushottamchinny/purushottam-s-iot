import React, { useState, useRef, useEffect } from 'react';
import { 
  UserCheck, 
  Camera, 
  Upload, 
  Trash2, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  ShieldAlert,
  User,
  Plus
} from 'lucide-react';
import { AuthorizedPerson } from '../types';
import { apiFetch } from '../api';

interface FaceRegistrationViewProps {
  persons: AuthorizedPerson[];
  onRefresh: () => void;
}

export const FaceRegistrationView: React.FC<FaceRegistrationViewProps> = ({
  persons,
  onRefresh,
}) => {
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'webcam' | 'upload'>('webcam');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showPurgeModal, setShowPurgeModal] = useState(false);

  // Webcam capture references
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  useEffect(() => {
    if (mode === 'webcam') {
      startWebcam();
    } else {
      stopWebcam();
    }
    return () => {
      stopWebcam();
    };
  }, [mode]);

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err) {
      setIsCameraActive(false);
      setFeedback({
        type: 'error',
        message: 'Could not access webcam for face registration. You can upload an image file instead.',
      });
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(dataUrl);
    setPreviewUrl(dataUrl);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setCapturedImage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFeedback({ type: 'error', message: 'Person name is required.' });
      return;
    }

    if (!capturedImage && !selectedFile) {
      setFeedback({ type: 'error', message: 'Please capture or upload a face image.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      let res;
      if (selectedFile) {
        const formData = new FormData();
        formData.append('name', name.trim());
        formData.append('image', selectedFile);
        res = await apiFetch('/api/person/register', {
          method: 'POST',
          body: formData,
        });
      } else if (capturedImage) {
        res = await apiFetch('/api/person/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            image: capturedImage,
          }),
        });
      }

      if (!res) return;
      const data = res.data;

      if (res.ok && data.success) {
        setFeedback({
          type: 'success',
          message: data.message || `Face sample registered for ${name}! (3-5 samples recommended per person)`,
        });
        setCapturedImage(null);
        setSelectedFile(null);
        setPreviewUrl(null);
        onRefresh();
      } else {
        setFeedback({
          type: 'error',
          message: data.message || 'Face validation failed. Ensure exactly one clear face is visible.',
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Network error during registration.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePerson = async (id: number, pName: string) => {
    if (!confirm(`Are you sure you want to delete '${pName}' and all stored face embeddings?`)) return;

    try {
      const res = await apiFetch(`/api/person/${id}`, { method: 'DELETE' });
      const data = res.data;
      if (res.ok) {
        setFeedback({ type: 'success', message: data.message });
        onRefresh();
      } else {
        setFeedback({ type: 'error', message: data.message || 'Failed to delete person.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Network error deleting person.' });
    }
  };

  const handlePurgeAllBiometrics = async () => {
    try {
      const res = await apiFetch('/api/person/biometrics/all', { method: 'DELETE' });
      const data = res.data;
      if (res.ok) {
        setFeedback({ type: 'success', message: data.message });
        setShowPurgeModal(false);
        onRefresh();
      } else {
        setFeedback({ type: 'error', message: data.message || 'Failed to purge biometrics.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Network error purging biometric data.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-emerald-400" />
            <span>Authorized Faces & Resident Enrollment</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Register family members, staff, and authorized guests. Recommend 3 to 5 samples per person under different angles.
          </p>
        </div>

        {/* Purge All Biometrics Button */}
        <button
          onClick={() => setShowPurgeModal(true)}
          className="px-3.5 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-xs font-semibold flex items-center gap-2 transition-all shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Erase All Biometric Data</span>
        </button>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Registration Form & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form (5 cols) */}
        <div className="lg:col-span-5 p-5 rounded-xl bg-slate-900/80 border border-slate-800">
          <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-400" />
            <span>Enroll New Face Sample</span>
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Authorized Individual Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Alex Johnson"
                className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-blue-500 outline-none"
                required
              />
            </div>

            {/* Mode Tabs */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Capture Method
              </label>
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setMode('webcam')}
                  className={`py-1.5 rounded-md font-medium transition-all ${
                    mode === 'webcam' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Live Webcam
                </button>
                <button
                  type="button"
                  onClick={() => setMode('upload')}
                  className={`py-1.5 rounded-md font-medium transition-all ${
                    mode === 'upload' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Upload File
                </button>
              </div>
            </div>

            {mode === 'upload' && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Select Face Photo (JPEG, PNG)
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handleFileChange}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
                />
              </div>
            )}

            {mode === 'webcam' && (
              <div>
                <button
                  type="button"
                  onClick={handleCapture}
                  disabled={!isCameraActive}
                  className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700 transition-all disabled:opacity-50"
                >
                  <Camera className="w-4 h-4 text-blue-400" />
                  <span>Snap Photo from Webcam</span>
                </button>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || (!capturedImage && !selectedFile) || !name.trim()}
              className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Extracting 128-d Embedding...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Validate & Store Embedding</span>
                </>
              )}
            </button>
          </form>

          {/* Validation Requirements Info */}
          <div className="mt-5 p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
            <p className="font-semibold text-slate-300">Face Validation Rules:</p>
            <p>&bull; Exactly 1 face per image (multi-face rejected).</p>
            <p>&bull; Minimum face bounding box 60&times;60 px.</p>
            <p>&bull; Sharpness variance &ge; 35 (avoids blurry faces).</p>
            <p>&bull; Embeddings stored locally; never sent off-device.</p>
          </div>
        </div>

        {/* Right Viewport (7 cols) */}
        <div className="lg:col-span-7 p-5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">
            {mode === 'webcam' ? 'Live Camera Feed & Snapshot Preview' : 'Uploaded File Preview'}
          </h3>

          <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 aspect-video flex items-center justify-center flex-1 min-h-[260px]">
            <canvas ref={canvasRef} className="hidden" />

            {previewUrl ? (
              <div className="relative w-full h-full flex items-center justify-center bg-slate-950">
                <img src={previewUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
                <button
                  type="button"
                  onClick={() => {
                    setPreviewUrl(null);
                    setCapturedImage(null);
                    setSelectedFile(null);
                  }}
                  className="absolute top-3 right-3 px-2.5 py-1 rounded bg-slate-900/90 hover:bg-slate-800 text-slate-300 text-xs border border-slate-700"
                >
                  Retake / Clear
                </button>
              </div>
            ) : mode === 'webcam' ? (
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center p-6 text-slate-400">
                <Upload className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs">Select an image file above to see preview</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Registered Persons List */}
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Registered Individuals</h3>
            <p className="text-xs text-slate-400">
              {persons.length} authorized {persons.length === 1 ? 'person' : 'people'} currently recognized by the system
            </p>
          </div>
          <button
            onClick={onRefresh}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        {persons.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400">
            No authorized individuals registered yet. Add family members or residents above.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {persons.map((p) => (
              <div
                key={p.id}
                className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between gap-3 hover:border-slate-700 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center text-slate-400">
                    {p.primary_image ? (
                      <img src={p.primary_image} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-6 h-6 text-slate-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-200 truncate">{p.name}</h4>
                    <p className="text-xs text-emerald-400 font-medium">
                      {p.sample_count} {p.sample_count === 1 ? 'embedding sample' : 'samples'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Enrolled {p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleDeletePerson(p.id, p.name)}
                  title={`Delete ${p.name}`}
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Modal: Purge All Biometric Data */}
      {showPurgeModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-100">Permanently Erase All Biometrics?</h3>
              <p className="text-xs text-slate-400 mt-1.5">
                This action will permanently delete all registered facial embeddings and sample images from the database and storage disk. Past presence log entries will remain preserved.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPurgeModal(false)}
                className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePurgeAllBiometrics}
                className="flex-1 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
              >
                Yes, Erase All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
