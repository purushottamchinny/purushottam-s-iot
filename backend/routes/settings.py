"""
System Settings Blueprint
Provides settings inspection and update with strict server-side validation against range limits.
"""

from flask import Blueprint, request, jsonify
from backend.routes.auth import login_required
from backend.database.models import SystemSettings
from backend.database.db import get_system_settings
from backend.config import Config, parse_float_val, parse_int_val, parse_bool_val
from backend.extensions import db

settings_bp = Blueprint("settings", __name__, url_prefix="/api/settings")

@settings_bp.route("", methods=["GET"])
@login_required
def get_settings():
    settings = get_system_settings()
    return jsonify({
        "settings": settings.to_dict(),
        "limits": Config.LIMITS,
        "gemini_api_key_configured": bool(Config.GEMINI_API_KEY)
    }), 200

@settings_bp.route("", methods=["PUT"])
@login_required
def update_settings():
    data = request.get_json(silent=True) or {}
    settings = get_system_settings()
    errors = {}

    # Validation
    if "camera_index" in data:
        val = parse_int_val(data["camera_index"], None)
        if val is None:
            errors["camera_index"] = "Must be a valid integer"
        else:
            min_v, max_v = Config.LIMITS["camera_index"]
            if not (min_v <= val <= max_v):
                errors["camera_index"] = f"Camera index must be between {min_v} and {max_v}"
            else:
                settings.camera_index = val

    if "detection_threshold" in data:
        val = parse_float_val(data["detection_threshold"], None)
        if val is None:
            errors["detection_threshold"] = "Must be a valid numeric value"
        else:
            min_v, max_v = Config.LIMITS["detection_threshold"]
            if not (min_v <= val <= max_v):
                errors["detection_threshold"] = f"Detection threshold must be between {min_v} and {max_v}"
            else:
                settings.detection_threshold = val

    if "recognition_threshold" in data:
        val = parse_float_val(data["recognition_threshold"], None)
        if val is None:
            errors["recognition_threshold"] = "Must be a valid numeric value"
        else:
            min_v, max_v = Config.LIMITS["recognition_threshold"]
            if not (min_v <= val <= max_v):
                errors["recognition_threshold"] = f"Recognition threshold must be between {min_v} and {max_v}"
            else:
                settings.recognition_threshold = val

    if "frame_interval" in data:
        val = parse_int_val(data["frame_interval"], None)
        if val is None:
            errors["frame_interval"] = "Must be a valid integer"
        else:
            min_v, max_v = Config.LIMITS["frame_interval"]
            if not (min_v <= val <= max_v):
                errors["frame_interval"] = f"Frame interval must be between {min_v} and {max_v}"
            else:
                settings.frame_interval = val

    if "cooldown_seconds" in data:
        val = parse_int_val(data["cooldown_seconds"], None)
        if val is None:
            errors["cooldown_seconds"] = "Must be a valid integer"
        else:
            min_v, max_v = Config.LIMITS["cooldown_seconds"]
            if not (min_v <= val <= max_v):
                errors["cooldown_seconds"] = f"Cooldown seconds must be between {min_v} and {max_v}"
            else:
                settings.cooldown_seconds = val

    if "retention_days" in data:
        val = parse_int_val(data["retention_days"], None)
        if val is None:
            errors["retention_days"] = "Must be a valid integer"
        else:
            min_v, max_v = Config.LIMITS["retention_days"]
            if not (min_v <= val <= max_v):
                errors["retention_days"] = f"Retention days must be between {min_v} and {max_v}"
            else:
                settings.retention_days = val

    if "sound_enabled" in data:
        settings.sound_enabled = parse_bool_val(data["sound_enabled"], True)

    if "gemini_enabled" in data:
        settings.gemini_enabled = parse_bool_val(data["gemini_enabled"], False)

    if errors:
        return jsonify({"error": "Validation Error", "fields": errors}), 422

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "System settings updated successfully",
        "settings": settings.to_dict()
    }), 200
