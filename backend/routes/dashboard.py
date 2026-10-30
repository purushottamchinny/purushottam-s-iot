"""
Dashboard Analytics Blueprint
Aggregates real-time database stats, recent activity feeds, and Chart.js trend series.
All numbers come directly from the database (no hardcoding).
"""

from datetime import datetime, timedelta
from flask import Blueprint, jsonify
from backend.routes.auth import login_required
from backend.database.models import Visitor, SecurityAlert, AuthorizedPerson
from backend.camera.camera_manager import camera_manager
from backend.extensions import db

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")

@dashboard_bp.route("/stats", methods=["GET"])
@login_required
def get_dashboard_stats():
    """Returns aggregated real-time database counts and 7-day trend series."""
    total_visitors = Visitor.query.count()
    authorized_count = Visitor.query.filter_by(recognition_status="authorized").count()
    unknown_count = Visitor.query.filter_by(recognition_status="unknown").count()
    unrecognized_count = Visitor.query.filter_by(recognition_status="unrecognized").count()
    registered_count = AuthorizedPerson.query.count()
    unreviewed_alerts = SecurityAlert.query.filter_by(status="new").count()

    # Generate 7-day timeline for Chart.js
    today = datetime.utcnow().date()
    labels = []
    auth_series = []
    unknown_series = []

    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_start = datetime.combine(day, datetime.min.time())
        day_end = datetime.combine(day, datetime.max.time())
        
        labels.append(day.strftime("%b %d"))
        
        # Count for day
        a_count = Visitor.query.filter(
            Visitor.recognition_status == "authorized",
            Visitor.timestamp >= day_start,
            Visitor.timestamp <= day_end
        ).count()
        auth_series.append(a_count)
        
        u_count = Visitor.query.filter(
            Visitor.recognition_status == "unknown",
            Visitor.timestamp >= day_start,
            Visitor.timestamp <= day_end
        ).count()
        unknown_series.append(u_count)

    cam_status = camera_manager.get_status()

    return jsonify({
        "stats": {
            "total_detections": total_visitors,
            "authorized_count": authorized_count,
            "unknown_count": unknown_count,
            "unrecognized_count": unrecognized_count,
            "registered_persons": registered_count,
            "unreviewed_alerts": unreviewed_alerts,
        },
        "camera": cam_status,
        "chart_data": {
            "labels": labels,
            "authorized": auth_series,
            "unknown": unknown_series
        }
    }), 200

@dashboard_bp.route("/activity", methods=["GET"])
@login_required
def get_recent_activity():
    """Returns the most recent 10 presence events and 5 recent alerts."""
    recent_visitors = Visitor.query.order_by(Visitor.timestamp.desc()).limit(10).all()
    recent_alerts = SecurityAlert.query.order_by(SecurityAlert.created_at.desc()).limit(5).all()

    return jsonify({
        "recent_visitors": [v.to_dict() for v in recent_visitors],
        "recent_alerts": [a.to_dict() for a in recent_alerts]
    }), 200
