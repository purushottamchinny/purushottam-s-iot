"""
Alert Management Service
Handles snapshot saving, Visitor record creation, SecurityAlert generation,
and real-time Socket.IO event dispatching.
"""

import os
import uuid
from datetime import datetime
import json
import cv2
import numpy as np
from typing import Dict, Any, Optional, Tuple
from backend.config import Config
from backend.database.models import Visitor, SecurityAlert
from backend.extensions import db, socketio
from backend.services.gemini_service import gemini_service

class AlertService:
    @staticmethod
    def create_unknown_visitor_alert(
        frame_bgr: np.ndarray, 
        detection_info: Dict[str, Any], 
        app
    ) -> Tuple[Visitor, SecurityAlert]:
        """
        Creates an unknown visitor event:
        1. Saves snapshot to disk
        2. Creates Visitor entry
        3. Creates SecurityAlert entry
        4. Dispatches Socket.IO notification
        5. Spawns async Gemini description if enabled
        """
        with app.app_context():
            # 1. Save snapshot to captured_images
            timestamp_str = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            unique_id = uuid.uuid4().hex[:8]
            filename = f"alert_{timestamp_str}_{unique_id}.jpg"
            filepath = Config.CAPTURED_IMAGES_DIR / filename
            
            # Save image
            if frame_bgr is not None and frame_bgr.size > 0:
                cv2.imwrite(str(filepath), frame_bgr, [cv2.IMWRITE_JPEG_QUALITY, 85])
                relative_path = f"/captured_images/{filename}"
            else:
                relative_path = None

            # 2. Create Visitor record
            visitor = Visitor(
                person_id=None,
                name="Unknown Visitor",
                recognition_status="unknown",
                confidence=float(detection_info.get("confidence", 0.0)),
                snapshot_path=relative_path,
                detection_info=json.dumps(detection_info),
                timestamp=datetime.utcnow()
            )
            db.session.add(visitor)
            db.session.flush()

            # 3. Create SecurityAlert record
            alert = SecurityAlert(
                visitor_id=visitor.id,
                alert_type="unrecognized_person",
                status="new",
                ai_description=None,
                created_at=datetime.utcnow()
            )
            db.session.add(alert)
            db.session.commit()

            # 4. Socket.IO real-time notification
            alert_payload = {
                "alert": alert.to_dict(),
                "visitor": visitor.to_dict(),
                "message": "Unrecognized person detected",
                "timestamp": visitor.timestamp.isoformat()
            }
            socketio.emit("unknown_visitor", alert_payload)

            # 5. Async Gemini alert description
            if relative_path and filepath.exists():
                gemini_service.generate_alert_description_async(alert.id, str(filepath), app)

            return visitor, alert

    @staticmethod
    def review_alert(alert_id: int) -> Optional[Dict[str, Any]]:
        """Marks a security alert as reviewed."""
        alert = db.session.get(SecurityAlert, alert_id)
        if not alert:
            return None
        alert.status = "reviewed"
        alert.reviewed_at = datetime.utcnow()
        db.session.commit()
        return alert.to_dict()

alert_service = AlertService()
