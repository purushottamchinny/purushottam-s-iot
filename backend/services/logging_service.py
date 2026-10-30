"""
Logging & Cooldown Service
Controls access record persistence, consecutive frame voting, and cooldown prevention.
Ensures observed presence events are properly recorded without duplicates.
"""

import time
import os
import uuid
import json
from datetime import datetime
from typing import Dict, Any, Optional
import cv2
import numpy as np
from backend.config import Config
from backend.database.models import Visitor, SystemSettings
from backend.extensions import db, socketio
from backend.services.alert_service import alert_service

class LoggingService:
    def __init__(self, consecutive_frames_required: int = 3):
        self.consecutive_frames_required = consecutive_frames_required
        # Track cooldowns: {track_id: last_logged_timestamp}
        self.last_logged_time_by_track: Dict[int, float] = {}
        # Person cooldowns (by name or person_id): {key: last_logged_timestamp}
        self.last_logged_time_by_identity: Dict[str, float] = {}

    def process_track_event(
        self, 
        track: Dict[str, Any], 
        frame_bgr: np.ndarray, 
        settings: SystemSettings, 
        app
    ) -> Optional[Dict[str, Any]]:
        """
        Evaluates a tracked person's accumulated recognition votes.
        If N consecutive frames agree and cooldown has expired, records the event.
        """
        track_id = track["track_id"]
        votes = track.get("recognition_votes", [])
        
        if len(votes) < self.consecutive_frames_required:
            return None

        # Check last N votes for consensus
        recent_votes = votes[-self.consecutive_frames_required:]
        statuses = [v[0] for v in recent_votes]
        
        # All N votes must agree on status
        if len(set(statuses)) != 1:
            return None

        confirmed_status = statuses[0]
        # Average confidence
        avg_conf = float(np.mean([v[2] for v in recent_votes]))
        # Take most frequent name
        names = [v[1] for v in recent_votes]
        confirmed_name = max(set(names), key=names.count)
        person_ids = [v[3] for v in recent_votes if v[3] is not None]
        confirmed_pid = person_ids[0] if person_ids else None

        # Check cooldown
        now = time.time()
        cooldown = settings.cooldown_seconds
        
        # Track-level cooldown
        last_track_time = self.last_logged_time_by_track.get(track_id, 0.0)
        if now - last_track_time < cooldown:
            return None

        # Identity-level cooldown
        id_key = f"{confirmed_status}_{confirmed_name}"
        last_id_time = self.last_logged_time_by_identity.get(id_key, 0.0)
        if now - last_id_time < cooldown:
            return None

        # Cooldown passed! Record event
        self.last_logged_time_by_track[track_id] = now
        self.last_logged_time_by_identity[id_key] = now
        track["last_logged_time"] = now
        track["confirmed_status"] = confirmed_status
        track["confirmed_name"] = confirmed_name

        detection_info = {
            "track_id": track_id,
            "bounding_box": track["box"],
            "confidence": avg_conf,
            "person_count": 1,
            "status": confirmed_status
        }

        # Case 1: Unknown Visitor -> triggers Security Alert & Snapshot
        if confirmed_status == "unknown":
            visitor, alert = alert_service.create_unknown_visitor_alert(
                frame_bgr=frame_bgr, 
                detection_info=detection_info, 
                app=app
            )
            return visitor.to_dict()

        # Case 2: Authorized Person -> saves snapshot and logs Visitor entry
        elif confirmed_status == "authorized":
            with app.app_context():
                timestamp_str = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
                unique_id = uuid.uuid4().hex[:8]
                filename = f"auth_{timestamp_str}_{unique_id}.jpg"
                filepath = Config.CAPTURED_IMAGES_DIR / filename

                if frame_bgr is not None and frame_bgr.size > 0:
                    cv2.imwrite(str(filepath), frame_bgr, [cv2.IMWRITE_JPEG_QUALITY, 85])
                    relative_path = f"/captured_images/{filename}"
                else:
                    relative_path = None

                visitor = Visitor(
                    person_id=confirmed_pid,
                    name=confirmed_name,
                    recognition_status="authorized",
                    confidence=avg_conf,
                    snapshot_path=relative_path,
                    detection_info=json.dumps(detection_info),
                    timestamp=datetime.utcnow()
                )
                db.session.add(visitor)
                db.session.commit()

                # Dispatch Socket.IO event
                socketio.emit("visitor_recognized", {
                    "visitor": visitor.to_dict(),
                    "message": f"Authorized resident/visitor: {confirmed_name}",
                    "timestamp": visitor.timestamp.isoformat()
                })
                return visitor.to_dict()

        # Case 3: Face not recognized (blurry / uncertain)
        # Specifically NOT logged as an unknown alert
        return None

logging_service = LoggingService()
