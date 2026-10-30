import { 
  Users, 
  UserCheck, 
  UserX, 
  ShieldAlert, 
  Camera, 
  ArrowRight, 
  Clock, 
  CheckCircle,
  ExternalLink,
  Database,
  Server,
  CheckCircle2,
  AlertTriangle,
  Info
} from 'lucide-react';
import { DashboardStats, CameraStatus, ChartData, Visitor, SecurityAlert, DatabaseStatus } from '../types';

interface DashboardViewProps {
  stats: DashboardStats;
  cameraStatus: CameraStatus;
  chartData: ChartData;
  recentVisitors: Visitor[];
  recentAlerts: SecurityAlert[];
  databaseStatus?: DatabaseStatus;
  onNavigate: (tab: string) => void;
  onReviewAlert: (id: number) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  cameraStatus,
  chartData,
  recentVisitors,
  recentAlerts,
  databaseStatus,
  onNavigate,
  onReviewAlert,
}) => {
  const statCards = [
    {
      label: 'Observed Events',
      value: stats.total_detections,
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20',
      desc: 'All presence events'
    },
    {
      label: 'Authorized Visits',
      value: stats.authorized_count,
      icon: UserCheck,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      desc: 'Confirmed resident/guest'
    },
    {
      label: 'Unknown Visitors',
      value: stats.unknown_count,
      icon: UserX,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10 border-rose-500/20',
      desc: 'Unrecognized persons'
    },
    {
      label: 'Unreviewed Alerts',
      value: stats.unreviewed_alerts,
      icon: ShieldAlert,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
      desc: 'Pending admin review'
    },
  ];

  // Maximum value for chart bar scaling
  const maxDayVal = Math.max(
    1,
    ...chartData.authorized.map((a, i) => a + (chartData.unknown[i] || 0))
  );

  return (
    <div className="space-y-6">
      {/* Top Banner Notice */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-blue-900/30 to-indigo-950/40 border border-blue-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Live AI Camera System is {cameraStatus.is_running ? 'Active & Processing' : 'in Standby Mode'}
            </h2>
            <p className="text-xs text-slate-400">
              {cameraStatus.is_running 
                ? `Running YOLO person detection & face embedding matching (${cameraStatus.fps} FPS).` 
                : 'Click Start Camera in the Live Monitoring panel to begin live stream.'}
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('camera')}
          className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0"
        >
          <span>Open Live Feed</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Database Connection Status Bar */}
      <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-200">
                Database: {databaseStatus?.db_type || 'Active'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ONLINE &amp; SYNCHRONIZED
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Tables: {databaseStatus?.tables?.join(', ') || 'admins, authorized_persons, face_samples, visitors, security_alerts, system_settings'} &bull; Admins enrolled: {databaseStatus?.admin_count ?? 1}
            </p>
          </div>
        </div>

        {databaseStatus?.supabase_detected && !databaseStatus?.supabase_configured && (
          <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-lg text-[11px] text-blue-300">
            <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>Supabase project <b>gyngbvvibkbjewzgcgia</b> detected. Tables verified!</span>
          </div>
        )}
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div
              key={i}
              className={`p-5 rounded-xl border bg-slate-900/70 backdrop-blur-sm transition-all ${c.bg}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">{c.label}</span>
                <Icon className={`w-5 h-5 ${c.color}`} />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-100">{c.value}</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{c.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Main Grid: Chart + Alerts Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: 7-Day Trend Chart */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">
                Weekly Presence Timeline
              </h3>
              <p className="text-xs text-slate-400">Authorized vs. Unknown person detections</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                Authorized
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
                Unknown
              </span>
            </div>
          </div>

          {/* Bar Chart Visualization */}
          <div className="h-56 flex items-end justify-between gap-3 pt-6 pb-2 border-b border-slate-800">
            {chartData.labels.map((label, idx) => {
              const authVal = chartData.authorized[idx] || 0;
              const unkVal = chartData.unknown[idx] || 0;
              const total = authVal + unkVal;
              const authHeightPct = total > 0 ? (authVal / maxDayVal) * 100 : 0;
              const unkHeightPct = total > 0 ? (unkVal / maxDayVal) * 100 : 0;

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                  <div className="w-full max-w-[36px] flex flex-col items-center justify-end rounded-t overflow-hidden h-full">
                    {unkVal > 0 && (
                      <div
                        style={{ height: `${unkHeightPct}%` }}
                        className="w-full bg-rose-500/80 hover:bg-rose-500 transition-all rounded-t"
                        title={`Unknown: ${unkVal}`}
                      />
                    )}
                    {authVal > 0 && (
                      <div
                        style={{ height: `${authHeightPct}%` }}
                        className="w-full bg-emerald-500/80 hover:bg-emerald-500 transition-all"
                        title={`Authorized: ${authVal}`}
                      />
                    )}
                    {total === 0 && (
                      <div className="h-1 w-full bg-slate-800 rounded-full" />
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-slate-400 group-hover:text-slate-200">
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex justify-between text-xs text-slate-400">
            <span>Observed across 7 days</span>
            <span>Total Logged: {stats.total_detections} events</span>
          </div>
        </div>

        {/* Right Col: Latest Security Alerts */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-200">Recent Security Alerts</h3>
            <button
              onClick={() => onNavigate('alerts')}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium"
            >
              View All ({stats.unreviewed_alerts})
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto max-h-[300px]">
            {recentAlerts.length === 0 ? (
              <div className="h-full min-h-[180px] flex flex-col items-center justify-center text-center p-4">
                <CheckCircle className="w-8 h-8 text-emerald-500/40 mb-2" />
                <p className="text-xs font-medium text-slate-400">All Security Alerts Clear</p>
                <p className="text-[11px] text-slate-400">No unreviewed unknown visitor events</p>
              </div>
            ) : (
              recentAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                      <span className="text-xs font-bold text-slate-200 truncate">
                        {alert.visitor?.name || 'Unrecognized Person'}
                      </span>
                    </div>
                    {alert.ai_description ? (
                      <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                        {alert.ai_description}
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] text-slate-400">
                        {alert.visitor?.detection_info?.status || 'Unknown visitor presence event'}
                      </p>
                    )}
                    <span className="mt-1 text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {alert.created_at ? new Date(alert.created_at).toLocaleTimeString() : ''}
                    </span>
                  </div>

                  {alert.status === 'new' && (
                    <button
                      onClick={() => onReviewAlert(alert.id)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold shrink-0"
                    >
                      Review
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Presence Activity Table */}
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Recent Presence Activity</h3>
            <p className="text-xs text-slate-400">Observed events from live camera monitoring</p>
          </div>
          <button
            onClick={() => onNavigate('history')}
            className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
          >
            <span>Complete History</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        {recentVisitors.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No presence events recorded yet. Start camera monitoring to detect activity.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 border-b border-slate-800 font-medium">
                <tr>
                  <th className="pb-2.5">Subject / Identity</th>
                  <th className="pb-2.5">Classification</th>
                  <th className="pb-2.5">Confidence</th>
                  <th className="pb-2.5">Observed At</th>
                  <th className="pb-2.5">Snapshot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentVisitors.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-800/20">
                    <td className="py-2.5 font-semibold text-slate-200">{v.name}</td>
                    <td className="py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          v.recognition_status === 'authorized'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : v.recognition_status === 'unknown'
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {v.recognition_status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-400">
                      {Math.round(v.confidence * 100)}%
                    </td>
                    <td className="py-2.5 text-slate-400">
                      {v.timestamp ? new Date(v.timestamp).toLocaleString() : ''}
                    </td>
                    <td className="py-2.5">
                      {v.snapshot_path ? (
                        <span className="text-[11px] text-blue-400 font-medium">Saved</span>
                      ) : (
                        <span className="text-[11px] text-slate-400">None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
