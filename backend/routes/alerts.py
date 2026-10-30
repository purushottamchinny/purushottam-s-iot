"""
Security Alerts Blueprint
Handles retrieval, review workflow, and detailed alert inspection.
"""

from flask import Blueprint, request, jsonify, current_app
from backend.routes.auth import login_required
from backend.database.models import SecurityAlert
from backend.services.alert_service import alert_service
from backend.services.gemini_service import gemini_service
from backend.config import Config
from backend.extensions import db

alerts_bp = Blueprint("alerts", __name__, url_prefix="/api/alerts")

@alerts_bp.route("", methods=["GET"])
@login_required
def get_alerts():
    """Retrieves paginated security alerts filtered by status."""
    page = request.args.get("page", 1, type=int)
    per_page = min(50, max(1, request.args.get("per_page", 20, type=int)))
    status_filter = (request.args.get("status") or "").strip().lower()

    query = SecurityAlert.query
    if status_filter in ["new", "reviewed"]:
        query = query.filter(SecurityAlert.status == status_filter)

    pagination = query.order_by(SecurityAlert.created_at.desc()).paginate(
        page=page, 
        per_page=per_page, 
        error_out=False
    )

    unreviewed_count = SecurityAlert.query.filter_by(status="new").count()

    return jsonify({
        "alerts": [a.to_dict() for a in pagination.items],
        "total": pagination.total,
        "unreviewed_count": unreviewed_count,
        "page": pagination.page,
        "pages": pagination.pages
    }), 200

@alerts_bp.route("/<int:alert_id>", methods=["GET"])
@login_required
def get_alert(alert_id):
    alert = db.session.get(SecurityAlert, alert_id)
    if not alert:
        return jsonify({"error": "Not Found", "message": "Alert not found"}), 404
    return jsonify(alert.to_dict()), 200

@alerts_bp.route("/<int:alert_id>/review", methods=["PATCH", "POST"])
@login_required
def review_alert(alert_id):
    reviewed = alert_service.review_alert(alert_id)
    if not reviewed:
        return jsonify({"error": "Not Found", "message": "Alert not found"}), 404
    return jsonify({"success": True, "alert": reviewed}), 200

@alerts_bp.route("/<int:alert_id>/describe", methods=["POST"])
@login_required
def generate_alert_description(alert_id):
    """Triggers on-demand AI description for an unknown visitor alert."""
    alert = db.session.get(SecurityAlert, alert_id)
    if not alert:
        return jsonify({"error": "Not Found", "message": "Alert not found"}), 404

    if not alert.visitor or not alert.visitor.snapshot_path:
        return jsonify({"error": "Bad Request", "message": "No snapshot available for this alert"}), 400

    full_path = Config.BASE_DIR / alert.visitor.snapshot_path.lstrip("/")
    if not full_path.exists():
        return jsonify({"error": "Not Found", "message": "Snapshot file not found on disk"}), 404

    # Trigger async generation
    gemini_service.generate_alert_description_async(alert.id, str(full_path), current_app._get_current_object())
    return jsonify({
        "success": True, 
        "message": "AI description request dispatched. Check back in a few seconds."
    }), 202
