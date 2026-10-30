"""
Gemini AI Service Module (Optional Free Tier)
Provides:
1. Asynchronous neutral AI Alert Descriptions for confirmed unknown visitor snapshots
2. Local Database-grounded Security Assistant Chat
3. Daily/Weekly Activity Summary Reports

Gemini is strictly prohibited from running per-frame or performing face recognition.
All Gemini features are OFF by default unless enabled in SystemSettings and a valid key is provided.
"""

import os
import time
import base64
import threading
from pathlib import Path
from typing import Optional, Dict, Any, Tuple
from backend.config import Config
from backend.database.models import SystemSettings, SecurityAlert, Visitor
from backend.extensions import db, socketio

# Optional Gemini SDK import
try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except Exception:
    GENAI_AVAILABLE = False

class GeminiService:
    def __init__(self):
        self.lock = threading.Lock()
        self.last_request_time = 0.0
        self.min_request_interval = 2.0  # Free tier rate limit safeguard (30 RPM max)

    def _get_client(self) -> Optional[Any]:
        """Returns initialized genai.Client if configured and available."""
        if not GENAI_AVAILABLE:
            return None
        api_key = os.environ.get("GEMINI_API_KEY", "").strip() or Config.GEMINI_API_KEY
        if not api_key:
            return None
        try:
            return genai.Client(api_key=api_key)
        except Exception as e:
            print(f"[GeminiService] Error initializing Gemini client: {e}")
            return None

    def is_enabled(self) -> bool:
        """Checks if Gemini features are toggled on in settings."""
        settings = SystemSettings.query.first()
        if not settings or not settings.gemini_enabled:
            return False
        key = os.environ.get("GEMINI_API_KEY", "").strip() or Config.GEMINI_API_KEY
        return bool(key)

    def generate_alert_description_async(self, alert_id: int, image_path: str, app):
        """Dispatches alert description generation in a background thread."""
        if not self.is_enabled():
            return
        thread = threading.Thread(
            target=self._run_alert_description, 
            args=(alert_id, image_path, app), 
            daemon=True
        )
        thread.start()

    def _run_alert_description(self, alert_id: int, image_path: str, app):
        with app.app_context():
            client = self._get_client()
            if not client:
                return

            if not os.path.exists(image_path):
                return

            # Respect rate limit
            with self.lock:
                elapsed = time.time() - self.last_request_time
                if elapsed < self.min_request_interval:
                    time.sleep(self.min_request_interval - elapsed)
                self.last_request_time = time.time()

            try:
                # Read snapshot image as base64
                with open(image_path, "rb") as f:
                    image_bytes = f.read()

                model_name = os.environ.get("GEMINI_MODEL", Config.GEMINI_MODEL)
                
                # Strict neutral description prompt according to specifications
                prompt = (
                    "You are a neutral smart home security camera assistant. "
                    "Provide a brief, factual, 1-2 sentence description of what is visible in this frame "
                    "(e.g., 'One person standing near the entrance wearing a blue jacket, daytime lighting'). "
                    "Rules: DO NOT guess or infer identity, age, gender, race/ethnicity, intent, or threat level. "
                    "Never call anyone an intruder or dangerous. State only observable physical surroundings and posture."
                )

                part = types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")
                response = client.models.generate_content(
                    model=model_name,
                    contents=[part, prompt]
                )

                description = (response.text or "").strip()
                if description:
                    alert = db.session.get(SecurityAlert, alert_id)
                    if alert:
                        alert.ai_description = description
                        db.session.commit()
                        
                        # Emit Socket.IO notification to update dashboard in real time
                        socketio.emit("alert_description_ready", {
                            "alert_id": alert_id,
                            "ai_description": description
                        })
            except Exception as e:
                print(f"[GeminiService] Description generation failed: {e}")

    def ask_assistant(self, user_question: str, context_data: Dict[str, Any]) -> str:
        """
        Answers security queries using local database aggregated stats as grounding.
        Never sends raw database or full images.
        """
        if not self.is_enabled():
            return "Gemini AI assistant is currently disabled or API key is not configured. You can enable it in Settings."

        client = self._get_client()
        if not client:
            return "AI service unavailable: Please check your GEMINI_API_KEY in the environment or Settings."

        # Rate limit safeguard
        with self.lock:
            elapsed = time.time() - self.last_request_time
            if elapsed < self.min_request_interval:
                time.sleep(self.min_request_interval - elapsed)
            self.last_request_time = time.time()

        model_name = os.environ.get("GEMINI_MODEL", Config.GEMINI_MODEL)
        
        prompt = (
            f"You are the intelligent Security Assistant for a Smart Home Monitoring System.\n"
            f"Grounding Data from local system database:\n"
            f"- Total Detections: {context_data.get('total_detections', 0)}\n"
            f"- Authorized Visits: {context_data.get('authorized_count', 0)}\n"
            f"- Unknown Visitors: {context_data.get('unknown_count', 0)}\n"
            f"- Unrecognized/Blurry Events: {context_data.get('unrecognized_count', 0)}\n"
            f"- Active Unreviewed Alerts: {context_data.get('active_alerts_count', 0)}\n"
            f"- Registered Residents/Personnel: {context_data.get('registered_count', 0)}\n"
            f"- Recent Activity Log Summary: {context_data.get('recent_summary', 'No recent events')}\n\n"
            f"User Question: {user_question}\n\n"
            f"Provide a concise, helpful, and professional answer based strictly on the provided system data. "
            f"Remind the user if relevant that the system records presence events and does not control doors."
        )

        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt
            )
            return (response.text or "Unable to generate answer.").strip()
        except Exception as e:
            return f"AI assistant query failed: {str(e)}"

    def generate_summary_report(self, context_data: Dict[str, Any], period: str = "daily") -> str:
        """Generates a structured security activity report from aggregated stats."""
        if not self.is_enabled():
            # Graceful local fallback summary without cloud AI
            return (
                f"### {period.capitalize()} Security Activity Summary (Local Offline Report)\n\n"
                f"- **Total Observed Presence Events**: {context_data.get('total_detections', 0)}\n"
                f"- **Authorized Entries**: {context_data.get('authorized_count', 0)}\n"
                f"- **Unrecognized / Unknown Presence**: {context_data.get('unknown_count', 0)}\n"
                f"- **Active Unreviewed Alerts**: {context_data.get('active_alerts_count', 0)}\n"
                f"- **Monitoring Status**: Active and observing.\n\n"
                f"*Note: Gemini AI enrichment is currently turned off in Settings.*"
            )

        client = self._get_client()
        if not client:
            return "Gemini service client offline. Showing local aggregated statistics."

        model_name = os.environ.get("GEMINI_MODEL", Config.GEMINI_MODEL)
        prompt = (
            f"Generate a professional, structured {period} Smart Home Security Report based on this aggregated activity:\n"
            f"- Total Presence Events: {context_data.get('total_detections', 0)}\n"
            f"- Authorized Visits: {context_data.get('authorized_count', 0)}\n"
            f"- Unknown Visitors: {context_data.get('unknown_count', 0)}\n"
            f"- Active Alerts: {context_data.get('active_alerts_count', 0)}\n"
            f"- Recent Events: {context_data.get('recent_summary', 'None')}\n\n"
            f"Include an Executive Overview, Activity Breakdown, and System Recommendations. Keep tone neutral and professional."
        )

        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt
            )
            return (response.text or "Report generation failed.").strip()
        except Exception as e:
            return f"Summary generation fallback: {str(e)}"

gemini_service = GeminiService()
