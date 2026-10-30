"""
Monitoring Pipeline Service
Orchestrates person detection, face recognition, multi-person tracking,
HUD overlay rendering, and event emission on live camera frames.
"""

import time
import cv2
import numpy as np
from typing import List, Dict, Any, Tuple
from backend.detection.person_detector import PersonDetector
from backend.detection.tracker import PersonTracker
from backend.recognition.face_detector import FaceDetector
from backend.recognition.face_recognizer import (
    FaceRecognizer, STATUS_AUTHORIZED, STATUS_UNKNOWN, STATUS_UNRECOGNIZED
)
from backend.services.logging_service import logging_service
from backend.database.models import AuthorizedPerson, FaceSample, SystemSettings
from backend.database.db import get_system_settings
from backend.extensions import db, socketio

class MonitoringService:
    def __init__(self, app=None):
        self.app = app
        self.person_detector = PersonDetector()
        self.person_tracker = PersonTracker()
        self.face_detector = FaceDetector()
        self.face_recognizer = FaceRecognizer()
        
        self.frame_counter = 0
        self.last_registered_cache = []
        self.last_cache_time = 0.0

    def init_app(self, app):
        self.app = app

    def _get_registered_people(self) -> List[Dict[str, Any]]:
        """Caches registered people and their embeddings for fast per-frame comparison."""
        now = time.time()
        # Refresh cache every 5 seconds
        if now - self.last_cache_time < 5.0 and len(self.last_registered_cache) > 0:
            return self.last_registered_cache

        if not self.app:
            return []

        with self.app.app_context():
            persons = AuthorizedPerson.query.all()
            cache = []
            for p in persons:
                embeddings = []
                for sample in p.samples:
                    if sample.embedding:
                        try:
                            # Reconstruct float32 numpy vector
                            emb = np.frombuffer(sample.embedding, dtype=np.float32)
                            norm = np.linalg.norm(emb)
                            if norm > 0:
                                emb = emb / norm
                            embeddings.append(emb)
                        except Exception:
                            pass
                cache.append({
                    "id": p.id,
                    "name": p.name,
                    "embeddings": embeddings
                })
            self.last_registered_cache = cache
            self.last_cache_time = now
            return cache

    def process_frame(self, frame_bgr: np.ndarray) -> np.ndarray:
        """
        Main camera frame worker callback:
        Runs YOLO person detection, tracking, face recognition, HUD annotation, and logging.
        """
        if frame_bgr is None or frame_bgr.size == 0:
            return frame_bgr

        self.frame_counter += 1
        annotated = frame_bgr.copy()
        h, w = frame_bgr.shape[:2]

        settings = None
        if self.app:
            try:
                with self.app.app_context():
                    settings = get_system_settings()
            except Exception:
                settings = None

        det_thresh = settings.detection_threshold if settings else 0.50
        rec_thresh = settings.recognition_threshold if settings else 0.60
        frame_interval = settings.frame_interval if settings else 3
        self.face_recognizer.recognition_threshold = rec_thresh

        # 1. Run YOLO person detection (every frame or frame_interval)
        detections = self.person_detector.detect(frame_bgr, conf_threshold=det_thresh)
        person_boxes = [d["box"] for d in detections]
        
        # 2. Update multi-person tracker
        tracks = self.person_tracker.update(person_boxes)

        # 3. Retrieve cached registered embeddings
        registered_people = self._get_registered_people()

        # Emit Socket.IO live person count
        live_person_count = len(detections)
        if self.frame_counter % 5 == 0:
            socketio.emit("person_detected", {
                "person_count": live_person_count,
                "fps": getattr(self.person_detector, "last_inference_time_ms", 0.0),
                "timestamp": time.time()
            })

        # 4. Face Recognition inside each tracked person crop
        for tid, track in tracks.items():
            tx1, ty1, tx2, ty2 = track["box"]
            person_crop = frame_bgr[ty1:ty2, tx1:tx2]
            
            status = STATUS_UNRECOGNIZED
            name = "Face Not Recognized"
            person_id = None
            conf = 0.0

            if person_crop.size > 0:
                # Detect face within person region
                faces = self.face_detector.detect_faces(person_crop)
                if len(faces) > 0:
                    # Choose largest face in person crop
                    face = max(faces, key=lambda f: (f["box"][2] - f["box"][0]) * (f["box"][3] - f["box"][1]))
                    fx1, fy1, fx2, fy2 = face["box"]
                    face_crop = person_crop[fy1:fy2, fx1:fx2]
                    
                    if face_crop.size > 0:
                        query_emb = self.face_recognizer.extract_embedding(face_crop)
                        status, name, person_id, conf = self.face_recognizer.compare_with_database(
                            query_emb, registered_people, face
                        )

            # Record vote into track history (status, name, confidence, person_id)
            track["recognition_votes"].append((status, name, conf, person_id))
            if len(track["recognition_votes"]) > 10:
                track["recognition_votes"].pop(0)

            # 5. Check consensus & cooldown in logging service
            if self.app and settings:
                logging_service.process_track_event(track, frame_bgr, settings, self.app)

            # 6. Render HUD Bounding Boxes on annotated frame
            color = (200, 160, 40)   # Amber (unrecognized)
            label = f"Person #{tid} - Scanning Face..."

            display_status = track.get("confirmed_status") or status
            display_name = track.get("confirmed_name") or name

            if display_status == STATUS_AUTHORIZED:
                color = (46, 204, 113)  # Emerald Green
                label = f"AUTHORIZED: {display_name} ({int(conf*100)}%)"
            elif display_status == STATUS_UNKNOWN:
                color = (60, 60, 235)   # Rose Red
                label = f"UNKNOWN VISITOR"
            elif display_status == STATUS_UNRECOGNIZED:
                color = (0, 190, 245)   # Amber/Gold
                label = f"Person #{tid} [Unrecognized Face]"

            # Draw box with rounded corners / thick frame
            cv2.rectangle(annotated, (tx1, ty1), (tx2, ty2), color, 2)
            
            # Label background badge
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)
            cv2.rectangle(annotated, (tx1, max(0, ty1 - 25)), (tx1 + tw + 10, max(0, ty1)), color, -1)
            cv2.putText(
                annotated, 
                label, 
                (tx1 + 5, max(18, ty1 - 7)), 
                cv2.FONT_HERSHEY_SIMPLEX, 
                0.55, 
                (255, 255, 255), 
                1, 
                cv2.LINE_AA
            )

        # 7. Render Top HUD Bar: Live System Stats
        hud_bg_h = 36
        cv2.rectangle(annotated, (0, 0), (w, hud_bg_h), (20, 24, 30), -1)
        hud_text = f"AI MONITORING ACTIVE | Persons: {live_person_count} | Latency: {self.person_detector.last_inference_time_ms}ms"
        cv2.putText(annotated, hud_text, (15, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 220, 240), 1, cv2.LINE_AA)

        # Status badge
        badge_text = "REC"
        cv2.circle(annotated, (w - 60, 18), 5, (0, 0, 240), -1)
        cv2.putText(annotated, badge_text, (w - 50, 23), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (240, 240, 240), 1, cv2.LINE_AA)

        return annotated

monitoring_service = MonitoringService()
