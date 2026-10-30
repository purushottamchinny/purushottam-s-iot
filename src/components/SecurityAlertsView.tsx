import React, { useState } from 'react';
import { 
  ShieldAlert, 
  CheckCircle, 
  Clock, 
  Sparkles, 
  Eye, 
  Filter, 
  X, 
  RefreshCw 
} from 'lucide-react';
import { SecurityAlert } from '../types';
import { apiFetch } from '../api';

interface SecurityAlertsViewProps {
  alerts: SecurityAlert[];
  onReviewAlert: (id: number) => void;
  onRefresh: () => void;
}

export const SecurityAlertsView: React.FC<SecurityAlertsViewProps> = ({
  alerts,
  onReviewAlert,
  onRefresh,
}) => {
  const [filter, setFilter] = useState<'all' | 'new' | 'reviewed'>('all');
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);
  const [requestingAiId, setRequestingAiId] = useState<number | null>(null);

  const filteredAlerts = alerts.filter((a) => {
    if (filter === 'new') return a.status === 'new';
    if (filter === 'reviewed') return a.status === 'reviewed';
    return true;
  });

  const handleRequestAiDescription = async (alertId: number) => {
    setRequestingAiId(alertId);
    try {
      const res = await apiFetch(`/api/alerts/${alertId}/describe`, { method: 'POST' });
      if (res.ok) {
        setTimeout(() => {
          onRefresh();
          setRequestingAiId(null);
        }, 3000);
      }
    } catch (err) {
      console.error(err);
      setRequestingAiId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <span>Security Alerts (Unrecognized Person Events)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time notifications triggered when an unrecognized face is clearly detected near the home.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Alerts</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            filter === 'all'
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          All Alerts ({alerts.length})
        </button>
        <button
          onClick={() => setFilter('new')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            filter === 'new'
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Pending Review ({alerts.filter((a) => a.status === 'new').length})
        </button>
        <button
          onClick={() => setFilter('reviewed')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            filter === 'reviewed'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Reviewed ({alerts.filter((a) => a.status === 'reviewed').length})
        </button>
      </div>

      {/* Alerts Feed Cards */}
      {filteredAlerts.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400 text-xs">
          No security alerts found in this view.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-5 rounded-xl border transition-all ${
                alert.status === 'new'
                  ? 'bg-slate-900/90 border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.06)]'
                  : 'bg-slate-900/60 border-slate-800 opacity-80'
              }`}
            >
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  {/* Thumbnail */}
                  {alert.visitor?.snapshot_path ? (
                    <button
                      onClick={() => setSelectedSnapshot(alert.visitor?.snapshot_path || null)}
                      className="w-16 h-16 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shrink-0 group relative"
                    >
                      <img
                        src={alert.visitor.snapshot_path}
                        alt="Alert Snapshot"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px]">
                        <Eye className="w-3.5 h-3.5" />
                      </div>
                    </button>
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                      <ShieldAlert className="w-6 h-6 text-rose-500/60" />
                    </div>
                  )}

                  {/* Details */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-bold text-slate-100">
                        Unrecognized Person Detected
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          alert.status === 'new'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {alert.status.toUpperCase()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400">
                      Detection confidence: {Math.round((alert.visitor?.confidence || 0) * 100)}% &bull; Subject label: {alert.visitor?.name || 'Unknown'}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {alert.created_at ? new Date(alert.created_at).toLocaleString() : ''}
                      </span>
                      {alert.reviewed_at && (
                        <span>
                          Reviewed {new Date(alert.reviewed_at).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  {alert.status === 'new' && (
                    <button
                      onClick={() => onReviewAlert(alert.id)}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Mark Reviewed</span>
                    </button>
                  )}
                  {alert.visitor?.snapshot_path && !alert.ai_description && (
                    <button
                      onClick={() => handleRequestAiDescription(alert.id)}
                      disabled={requestingAiId === alert.id}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 text-xs font-semibold flex items-center gap-1.5 border border-purple-500/30 disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      <span>{requestingAiId === alert.id ? 'Generating...' : 'AI Describe'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* AI Description Container */}
              {alert.ai_description && (
                <div className="mt-3 p-3 rounded-lg bg-purple-950/20 border border-purple-500/20 text-xs text-purple-200 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-purple-300">AI Scene Description: </span>
                    <span>{alert.ai_description}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Snapshot Preview Modal */}
      {selectedSnapshot && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="relative max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-200">Alert Trigger Snapshot</h4>
              <button
                onClick={() => setSelectedSnapshot(null)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-slate-950">
              <img
                src={selectedSnapshot}
                alt="Alert Snapshot"
                className="max-h-[500px] w-auto object-contain rounded-lg border border-slate-800"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
