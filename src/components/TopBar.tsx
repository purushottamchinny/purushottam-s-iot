import React from 'react';
import { Camera, Volume2, VolumeX, Bell, AlertTriangle, ShieldCheck } from 'lucide-react';
import { CameraStatus } from '../types';

interface TopBarProps {
  cameraStatus: CameraStatus;
  unreviewedAlerts: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onNavigateToAlerts: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  cameraStatus,
  unreviewedAlerts,
  soundEnabled,
  onToggleSound,
  onNavigateToAlerts,
}) => {
  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Left: Camera Operational Indicator */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs font-semibold">
          <span
            className={`w-2 h-2 rounded-full ${
              cameraStatus.is_running
                ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse'
                : 'bg-amber-500'
            }`}
          />
          <span className="text-slate-300">
            {cameraStatus.is_running ? 'SYSTEM OBSERVING' : 'CAMERA STANDBY'}
          </span>
          {cameraStatus.fps > 0 && (
            <span className="text-slate-400 border-l border-slate-700 pl-2">
              {cameraStatus.fps} FPS
            </span>
          )}
        </div>

        <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 bg-slate-950/40 px-3 py-1.5 rounded-lg border border-slate-800/60">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
          <span>Presence Observation System &bull; Does not control doors</span>
        </div>
      </div>

      {/* Right: Quick Controls & Alert Badge */}
      <div className="flex items-center gap-3">
        {/* Sound Alert Mute Toggle */}
        <button
          onClick={onToggleSound}
          title={soundEnabled ? 'Alert Sounds Active' : 'Alert Sounds Muted'}
          className={`p-2 rounded-lg border transition-all text-xs font-medium flex items-center gap-1.5 ${
            soundEnabled
              ? 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-800'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20'
          }`}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
          <span className="hidden sm:inline">{soundEnabled ? 'Audio On' : 'Muted'}</span>
        </button>

        {/* Security Alerts Quick Badge */}
        <button
          onClick={onNavigateToAlerts}
          className={`relative p-2 rounded-lg border transition-all flex items-center gap-1.5 ${
            unreviewedAlerts > 0
              ? 'bg-rose-500/15 border-rose-500/30 text-rose-400 animate-pulse'
              : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
          title={`${unreviewedAlerts} unreviewed alerts`}
        >
          <Bell className="w-4 h-4" />
          {unreviewedAlerts > 0 && (
            <span className="text-xs font-bold text-rose-400 px-1.5">
              {unreviewedAlerts}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
