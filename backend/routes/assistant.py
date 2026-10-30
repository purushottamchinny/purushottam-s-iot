"""
AI Assistant & Reports Blueprint
Handles natural language security inquiries and structured summary generation
grounded strictly in local database presence metrics.
"""

import html
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from backend.routes.auth import login_required
from backend.database.models import Visitor, SecurityAlert, AuthorizedPerson
from backend.services.gemini_service import gemini_service

assistant_bp = Blueprint("assistant", __name__, url_prefix="/api")

def _build_context_summary() -> dict:
    """Extracts aggregated database metrics to safely ground AI queries."""
    total = Visitor.query.count()
    auth_cnt = Visitor.query.filter_by(recognition_status="authorized").count()
    unknown_cnt = Visitor.query.filter_by(recognition_status="unknown").count()
    unrec_cnt = Visitor.query.filter_by(recognition_status="unrecognized").count()
    active_alerts = SecurityAlert.query.filter_by(status="new").count()
    registered = AuthorizedPerson.query.count()

    recent_events = Visitor.query.order_by(Visitor.timestamp.desc()).limit(5).all()
    events_str = ", ".join([f"{e.name} ({e.recognition_status} at {e.timestamp.strftime('%H:%M') if e.timestamp else ''})" for e in recent_events]) or "None"

    return {
        "total_detections": total,
        "authorized_count": auth_cnt,
        "unknown_count": unknown_cnt,
        "unrecognized_count": unrec_cnt,
        "active_alerts_count": active_alerts,
        "registered_count": registered,
        "recent_summary": events_str
    }

@assistant_bp.route("/assistant/ask", methods=["POST"])
@login_required
def ask_assistant():
    """Answers admin security queries grounded in local system records."""
    data = request.get_json(silent=True) or {}
    question = (data.get("question") or "").strip()
    
    if not question:
        return jsonify({"error": "Bad Request", "message": "Question is required"}), 400

    context = _build_context_summary()
    raw_answer = gemini_service.ask_assistant(question, context)
    safe_answer = html.escape(raw_answer)

    return jsonify({
        "question": question,
        "answer": safe_answer,
        "is_ai_generated": gemini_service.is_enabled()
    }), 200

@assistant_bp.route("/reports/summary", methods=["GET"])
@login_required
def get_summary_report():
    """Generates an executive daily or weekly activity summary report."""
    period = request.args.get("period", "daily").lower()
    if period not in ["daily", "weekly"]:
        period = "daily"

    context = _build_context_summary()
    report = gemini_service.generate_summary_report(context, period)
    safe_report = html.escape(report)

    return jsonify({
        "period": period,
        "report": safe_report,
        "generated_at": datetime.utcnow().isoformat()
    }), 200
