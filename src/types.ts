export interface User {
  id: number;
  username: string;
}

export interface DashboardStats {
  total_detections: number;
  authorized_count: number;
  unknown_count: number;
  unrecognized_count: number;
  registered_persons: number;
  unreviewed_alerts: number;
}

export interface CameraStatus {
  is_running: boolean;
  is_hardware_connected: boolean;
  is_external_stream: boolean;
  camera_index: number;
  fps: number;
  last_error: string;
  has_frames: boolean;
}

export interface ChartData {
  labels: string[];
  authorized: number[];
  unknown: number[];
}

export interface Visitor {
  id: number;
  person_id: number | null;
  name: string;
  recognition_status: 'authorized' | 'unknown' | 'unrecognized';
  confidence: number;
  snapshot_path: string | null;
  detection_info: any;
  timestamp: string;
  event_type?: string;
}

export interface SecurityAlert {
  id: number;
  visitor_id: number;
  alert_type: string;
  status: 'new' | 'reviewed';
  ai_description: string | null;
  created_at: string;
  reviewed_at: string | null;
  visitor?: Visitor;
}

export interface AuthorizedPerson {
  id: number;
  name: string;
  sample_count: number;
  primary_image: string | null;
  created_at: string;
}

export interface SystemSettings {
  id?: number;
  camera_index: number;
  detection_threshold: number;
  recognition_threshold: number;
  frame_interval: number;
  cooldown_seconds: number;
  sound_enabled: boolean;
  gemini_enabled: boolean;
  retention_days: number;
  updated_at?: string;
}

export interface DatabaseStatus {
  connected: boolean;
  db_type: string;
  uri_masked: string;
  tables: string[];
  admin_count: number;
  visitor_count: number;
  error?: string | null;
  supabase_configured: boolean;
  supabase_detected: boolean;
  supabase_project_ref?: string | null;
}

