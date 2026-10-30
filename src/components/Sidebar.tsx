import React from 'react';
import { 
  LayoutDashboard, 
  Camera, 
  UserCheck, 
  History, 
  ShieldAlert, 
  Settings, 
  Bot, 
  LogOut,
  ShieldCheck
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  unreviewedAlerts: number;
  onLogout: () => void;
  currentUser: { username: string } | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  unreviewedAlerts,
  onLogout,
  currentUser,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'camera', label: 'Live Monitoring', icon: Camera },
    { id: 'faces', label: 'Face Registration', icon: UserCheck },
    { id: 'history', label: 'Access History', icon: History },
    { 
      id: 'alerts', 
      label: 'Security Alerts', 
      icon: ShieldAlert, 
      badge: unreviewedAlerts > 0 ? unreviewedAlerts : undefined 
    },
    { id: 'assistant', label: 'AI Assistant', icon: Bot },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-slate-900/90 border-r border-slate-800 flex flex-col shrink-0 h-screen sticky top-0 backdrop-blur-md select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-bold text-slate-100 text-sm tracking-tight leading-snug">
            Smart Home AI
          </h1>
          <p className="text-xs text-slate-400 font-medium">Access Monitoring</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 border border-rose-500/30 text-rose-400">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User & Logout Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <p className="text-xs text-slate-400 font-medium truncate">Logged in as</p>
            <p className="text-sm font-semibold text-slate-200 truncate">
              {currentUser?.username || 'Admin'}
            </p>
          </div>
          <button
            onClick={onLogout}
            title="Log Out"
            className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
