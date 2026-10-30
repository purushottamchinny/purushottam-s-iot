import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { DashboardView } from './components/DashboardView';
import { LiveMonitoringView } from './components/LiveMonitoringView';
import { FaceRegistrationView } from './components/FaceRegistrationView';
import { AccessHistoryView } from './components/AccessHistoryView';
import { SecurityAlertsView } from './components/SecurityAlertsView';
import { GeminiAssistantView } from './components/GeminiAssistantView';
import { SettingsView } from './components/SettingsView';
import { LoginModal } from './components/LoginModal';
import { 
  DashboardStats, 
  CameraStatus, 
  ChartData, 
  Visitor, 
  SecurityAlert, 
  AuthorizedPerson, 
  SystemSettings,
  DatabaseStatus
} from './types';
import { apiFetch, clearAuthToken } from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState<{ id: number; username: string } | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('smarthome_sound_muted') !== 'true';
  });

  // Database Connection Info
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus>({
    connected: true,
    db_type: 'SQLite (Local File)',
    uri_masked: 'sqlite:///smart_home_security.db',
    tables: ['admins', 'authorized_persons', 'face_samples', 'visitors', 'security_alerts', 'system_settings'],
    admin_count: 1,
    visitor_count: 0,
    supabase_configured: false,
    supabase_detected: false,
  });

  // State data
  const [stats, setStats] = useState<DashboardStats>({
    total_detections: 0,
    authorized_count: 0,
    unknown_count: 0,
    unrecognized_count: 0,
    registered_persons: 0,
    unreviewed_alerts: 0,
  });

  const [cameraStatus, setCameraStatus] = useState<CameraStatus>({
    is_running: false,
    is_hardware_connected: false,
    is_external_stream: false,
    camera_index: 0,
    fps: 0,
    last_error: '',
    has_frames: false,
  });

  const [chartData, setChartData] = useState<ChartData>({
    labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'],
    authorized: [0, 0, 0, 0, 0, 0, 0],
    unknown: [0, 0, 0, 0, 0, 0, 0],
  });

  const [recentVisitors, setRecentVisitors] = useState<Visitor[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<SecurityAlert[]>([]);
  const [allAlerts, setAllAlerts] = useState<SecurityAlert[]>([]);
  const [registeredPersons, setRegisteredPersons] = useState<AuthorizedPerson[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    camera_index: 0,
    detection_threshold: 0.50,
    recognition_threshold: 0.60,
    frame_interval: 3,
    cooldown_seconds: 45,
    sound_enabled: true,
    gemini_enabled: false,
    retention_days: 30,
  });

  // Check auth and database on mount
  useEffect(() => {
    checkSession();
    fetchDatabaseStatus();

    const handleUnauthorized = () => {
      setIsAuthModalOpen(true);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const checkSession = async () => {
    try {
      const res = await apiFetch<{ authenticated: boolean; user: any }>('/api/session');
      if (res.ok && res.data.authenticated && res.data.user) {
        setCurrentUser(res.data.user);
        setIsAuthModalOpen(false);
        refreshAllData();
      } else {
        // Auto-login fallback with default admin credentials
        const loginRes = await apiFetch<{ success: boolean; token: string; user: any }>('/api/login', {
          method: 'POST',
          body: JSON.stringify({ username: 'admin', password: 'Admin12345!' }),
        });
        if (loginRes.ok && loginRes.data.success && loginRes.data.user) {
          if (loginRes.data.token) {
            localStorage.setItem('smarthome_auth_token', loginRes.data.token);
          }
          setCurrentUser(loginRes.data.user);
          setIsAuthModalOpen(false);
          refreshAllData();
        } else {
          setCurrentUser(null);
          setIsAuthModalOpen(true);
        }
      }
    } catch (err) {
      setCurrentUser(null);
      setIsAuthModalOpen(true);
    }
  };

  const handleLoginSuccess = (user: { id: number; username: string }) => {
    setCurrentUser(user);
    setIsAuthModalOpen(false);
    refreshAllData();
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/logout', { method: 'POST' });
    } catch (err) {}
    clearAuthToken();
    setCurrentUser(null);
    setIsAuthModalOpen(true);
  };

  const fetchDatabaseStatus = async () => {
    try {
      const res = await apiFetch<DatabaseStatus>('/api/database/status');
      if (res.ok && res.data) {
        setDatabaseStatus(res.data);
      }
    } catch (err) {}
  };

  // Data fetching routines
  const fetchDashboardStats = async () => {
    try {
      const res = await apiFetch<{ stats: DashboardStats; camera: CameraStatus; chart_data: ChartData }>('/api/dashboard/stats');
      if (res.ok && res.data) {
        if (res.data.stats) setStats(res.data.stats);
        if (res.data.camera) setCameraStatus(res.data.camera);
        if (res.data.chart_data) setChartData(res.data.chart_data);
      }
    } catch (err) {}
  };

  const fetchRecentActivity = async () => {
    try {
      const res = await apiFetch<{ recent_visitors: Visitor[]; recent_alerts: SecurityAlert[] }>('/api/dashboard/activity');
      if (res.ok && res.data) {
        setRecentVisitors(res.data.recent_visitors || []);
        setRecentAlerts(res.data.recent_alerts || []);
      }
    } catch (err) {}
  };

  const fetchAlerts = async () => {
    try {
      const res = await apiFetch<{ alerts: SecurityAlert[] }>('/api/alerts?per_page=50');
      if (res.ok && res.data) {
        setAllAlerts(res.data.alerts || []);
      }
    } catch (err) {}
  };

  const fetchRegisteredPersons = async () => {
    try {
      const res = await apiFetch<{ persons: AuthorizedPerson[] }>('/api/person/list');
      if (res.ok && res.data) {
        setRegisteredPersons(res.data.persons || []);
      }
    } catch (err) {}
  };

  const fetchSettings = async () => {
    try {
      const res = await apiFetch<{ settings: SystemSettings }>('/api/settings');
      if (res.ok && res.data?.settings) {
        setSystemSettings(res.data.settings);
      }
    } catch (err) {}
  };

  const refreshAllData = () => {
    fetchDashboardStats();
    fetchRecentActivity();
    fetchAlerts();
    fetchRegisteredPersons();
    fetchSettings();
    fetchDatabaseStatus();
  };

  // Periodic polling for real-time stats and camera
  useEffect(() => {
    if (!currentUser) return;
    const timer = setInterval(() => {
      fetchDashboardStats();
      fetchRecentActivity();
      if (activeTab === 'alerts') fetchAlerts();
    }, 4000);
    return () => clearInterval(timer);
  }, [currentUser, activeTab]);

  const handleStartCamera = async () => {
    try {
      const res = await apiFetch<{ status: CameraStatus }>('/api/camera/start', { method: 'POST' });
      if (res.ok && res.data?.status) setCameraStatus(res.data.status);
    } catch (err) {}
  };

  const handleStopCamera = async () => {
    try {
      const res = await apiFetch<{ status: CameraStatus }>('/api/camera/stop', { method: 'POST' });
      if (res.ok && res.data?.status) setCameraStatus(res.data.status);
    } catch (err) {}
  };

  const handleReviewAlert = async (id: number) => {
    try {
      const res = await apiFetch(`/api/alerts/${id}/review`, { method: 'PATCH' });
      if (res.ok) {
        fetchDashboardStats();
        fetchRecentActivity();
        fetchAlerts();
      }
    } catch (err) {}
  };

  const handleUpdateSettings = async (newSettings: Partial<SystemSettings>): Promise<boolean> => {
    try {
      const res = await apiFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      return res.ok;
    } catch (err) {
      return false;
    }
  };

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('smarthome_sound_muted', next ? 'false' : 'true');
      return next;
    });
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        unreviewedAlerts={stats.unreviewed_alerts}
        onLogout={handleLogout}
        currentUser={currentUser}
      />

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar
          cameraStatus={cameraStatus}
          unreviewedAlerts={stats.unreviewed_alerts}
          soundEnabled={soundEnabled}
          onToggleSound={toggleSound}
          onNavigateToAlerts={() => setActiveTab('alerts')}
        />

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {activeTab === 'dashboard' && (
            <DashboardView
              stats={stats}
              cameraStatus={cameraStatus}
              chartData={chartData}
              recentVisitors={recentVisitors}
              recentAlerts={recentAlerts}
              databaseStatus={databaseStatus}
              onNavigate={setActiveTab}
              onReviewAlert={handleReviewAlert}
            />
          )}

          {activeTab === 'camera' && (
            <LiveMonitoringView
              cameraStatus={cameraStatus}
              onStartCamera={handleStartCamera}
              onStopCamera={handleStopCamera}
            />
          )}

          {activeTab === 'faces' && (
            <FaceRegistrationView
              persons={registeredPersons}
              onRefresh={fetchRegisteredPersons}
            />
          )}

          {activeTab === 'history' && <AccessHistoryView />}

          {activeTab === 'alerts' && (
            <SecurityAlertsView
              alerts={allAlerts}
              onReviewAlert={handleReviewAlert}
              onRefresh={fetchAlerts}
            />
          )}

          {activeTab === 'assistant' && (
            <GeminiAssistantView isGeminiEnabled={systemSettings.gemini_enabled} />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={systemSettings}
              cameraStatus={cameraStatus}
              onUpdateSettings={handleUpdateSettings}
              onRefresh={fetchSettings}
            />
          )}
        </main>
      </div>

      {/* Authentication Modal */}
      <LoginModal isOpen={isAuthModalOpen} onLoginSuccess={handleLoginSuccess} />
    </div>
  );
}
