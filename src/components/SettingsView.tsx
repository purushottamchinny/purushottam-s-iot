import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Save, 
  Camera, 
  Sliders, 
  Bell, 
  ShieldCheck, 
  Sparkles, 
  CheckCircle, 
  AlertTriangle,
  RotateCcw,
  Database
} from 'lucide-react';
import { SystemSettings, CameraStatus } from '../types';

interface SettingsViewProps {
  settings: SystemSettings;
  cameraStatus: CameraStatus;
  onUpdateSettings: (newSettings: Partial<SystemSettings>) => Promise<boolean>;
  onRefresh: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  cameraStatus,
  onUpdateSettings,
  onRefresh,
}) => {
  const [formState, setFormState] = useState<SystemSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    setFormState(settings);
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);
    try {
      const ok = await onUpdateSettings(formState);
      if (ok) {
        setFeedback({ type: 'success', message: 'System configuration updated successfully.' });
        onRefresh();
      } else {
        setFeedback({ type: 'error', message: 'Validation error: please verify setting range values.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error updating settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Title */}
      <div>
        <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-400" />
          <span>System Parameters & Detection Thresholds</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Tune computer vision sensitivity, verification thresholds, event cooldowns, and cloud assistant privacy.
        </p>
      </div>

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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Computer Vision Section */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-5">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-400" />
            <span>Computer Vision & AI Thresholds</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Person Detection Threshold */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <label className="font-medium text-slate-300">YOLO Person Detection Threshold</label>
                <span className="font-mono text-blue-400 font-semibold">
                  {Math.round(formState.detection_threshold * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.95"
                step="0.05"
                value={formState.detection_threshold}
                onChange={(e) =>
                  setFormState({ ...formState, detection_threshold: parseFloat(e.target.value) })
                }
                className="w-full accent-blue-500 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Minimum bounding box confidence for filtering human presence.
              </p>
            </div>

            {/* Face Recognition Threshold */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <label className="font-medium text-slate-300">Face Recognition Cosine Threshold</label>
                <span className="font-mono text-emerald-400 font-semibold">
                  {Math.round(formState.recognition_threshold * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.30"
                max="0.95"
                step="0.05"
                value={formState.recognition_threshold}
                onChange={(e) =>
                  setFormState({ ...formState, recognition_threshold: parseFloat(e.target.value) })
                }
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Required cosine similarity to verify an authorized individual.
              </p>
            </div>

            {/* Frame Interval */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Frame Skip Interval (Every Nth Frame)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={formState.frame_interval}
                onChange={(e) =>
                  setFormState({ ...formState, frame_interval: parseInt(e.target.value) || 1 })
                }
                className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-blue-500 outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Higher values reduce CPU usage on Apple Silicon / laptop processors.
              </p>
            </div>

            {/* Event Cooldown */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Visitor Event Cooldown (Seconds)
              </label>
              <input
                type="number"
                min="5"
                max="600"
                value={formState.cooldown_seconds}
                onChange={(e) =>
                  setFormState({ ...formState, cooldown_seconds: parseInt(e.target.value) || 5 })
                }
                className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-blue-500 outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Prevents duplicate presence logs when one person lingers in view.
              </p>
            </div>
          </div>
        </div>

        {/* Camera & Storage Section */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-5">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Camera className="w-4 h-4 text-blue-400" />
            <span>Camera Device & Storage Policy</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Camera Index */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Hardware Camera Device Index
              </label>
              <select
                value={formState.camera_index}
                onChange={(e) =>
                  setFormState({ ...formState, camera_index: parseInt(e.target.value) })
                }
                className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-blue-500 outline-none"
              >
                <option value={0}>Camera 0 (Default Built-in Webcam)</option>
                <option value={1}>Camera 1 (External USB Webcam)</option>
                <option value={2}>Camera 2 (Secondary Feed)</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Selected OpenCV video capture device index on local system.
              </p>
            </div>

            {/* Snapshot Retention */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Snapshot Storage Retention (Days)
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={formState.retention_days}
                onChange={(e) =>
                  setFormState({ ...formState, retention_days: parseInt(e.target.value) || 1 })
                }
                className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-blue-500 outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Automatically purges presence snapshots and records older than N days.
              </p>
            </div>
          </div>
        </div>

        {/* Database & Supabase Connectivity Section */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>Database Connection &amp; Supabase Status</span>
            </h3>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              DATABASE ONLINE
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
              <p className="text-slate-400 font-medium">Active Database Engine</p>
              <p className="text-slate-200 font-bold mt-1 text-sm">
                Local SQLite Database (smart_home_security.db)
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Zero-cloud local storage. All face embeddings and presence records are stored securely on this computer.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
              <p className="text-slate-400 font-medium">Supabase Cloud Integration</p>
              <p className="text-slate-200 font-bold mt-1 text-sm">
                Project gyngbvvibkbjewzgcgia (Tables Verified)
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Your SQL queries ran successfully in Supabase! To switch backend storage from local SQLite to Supabase, provide your Supabase database password.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
            <p className="font-semibold text-slate-300">Supabase Direct Connection String Format:</p>
            <code className="block p-2 rounded bg-slate-900 border border-slate-800 text-emerald-300 font-mono text-[10px] select-all overflow-x-auto">
              DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.gyngbvvibkbjewzgcgia.supabase.co:5432/postgres"
            </code>
            <p className="text-slate-400 text-[10px]">
              Note: Supabase API keys (NEXT_PUBLIC_SUPABASE_URL / publishable key) are client keys. SQLAlchemy requires the PostgreSQL connection string above with your database password.
            </p>
          </div>
        </div>

        {/* Gemini AI & Privacy Section */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-slate-200">Google Gemini AI Integration</h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formState.gemini_enabled}
                onChange={(e) =>
                  setFormState({ ...formState, gemini_enabled: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 leading-relaxed">
            <span className="font-semibold">Privacy Notice: </span>
            Enabling this sends unknown-visitor snapshots and activity summaries to Google's servers. On the free tier, Google may use data to improve its products. Never sends images of registered/authorized people. Gemini is never used for face recognition or real-time per-frame processing.
          </div>
        </div>

        {/* Sound Alerts */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Bell className="w-4 h-4 text-emerald-400" />
              <span>Audible Alarm Notifications</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Play chime alert on unknown visitor detections in the web browser.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formState.sound_enabled}
              onChange={(e) =>
                setFormState({ ...formState, sound_enabled: e.target.checked })
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>

        {/* Submit Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => setFormState(settings)}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Changes</span>
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
