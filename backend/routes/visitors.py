"""
Visitor Access History Blueprint
Provides search, filtering by date/status, pagination, record deletion with snapshot cleanup,
and CSV export of observed presence events.
"""

import os
import io
import csv
from datetime import datetime
from flask import Blueprint, request, jsonify, Response
from backend.routes.auth import login_required
from backend.database.models import Visitor
from backend.config import Config
from backend.extensions import db

visitors_bp = Blueprint("visitors", __name__, url_prefix="/api/visitors")

@visitors_bp.route("", methods=["GET"])
@login_required
def get_visitors():
    """
    Retrieves paginated visitor access history with name search and status/date filtering.
    """
    page = request.args.get("page", 1, type=int)
    per_page = min(100, max(1, request.args.get("per_page", 20, type=int)))
    name_query = (request.args.get("name") or "").strip()
    status_filter = (request.args.get("status") or "").strip().lower()
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    query = Visitor.query

    if name_query:
        query = query.filter(Visitor.name.ilike(f"%{name_query}%"))

    if status_filter in ["authorized", "unknown", "unrecognized"]:
        query = query.filter(Visitor.recognition_status == status_filter)

    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date)
            query = query.filter(Visitor.timestamp >= start_dt)
        except ValueError:
            pass

    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date)
            query = query.filter(Visitor.timestamp <= end_dt)
        except ValueError:
            pass

    pagination = query.order_by(Visitor.timestamp.desc()).paginate(
        page=page, 
        per_page=per_page, 
        error_out=False
    )

    return jsonify({
        "visitors": [v.to_dict() for v in pagination.items],
        "total": pagination.total,
        "page": pagination.page,
        "pages": pagination.pages,
        "per_page": per_page,
        "note": "Records represent observed presence events, not verified door control entries."
    }), 200

@visitors_bp.route("/<int:visitor_id>", methods=["GET"])
@login_required
def get_visitor(visitor_id):
    visitor = db.session.get(Visitor, visitor_id)
    if not visitor:
        return jsonify({"error": "Not Found", "message": "Visitor record not found"}), 404
    return jsonify(visitor.to_dict()), 200

@visitors_bp.route("/<int:visitor_id>", methods=["DELETE"])
@login_required
def delete_visitor(visitor_id):
    """Deletes a visitor presence event and removes its snapshot image from disk."""
    visitor = db.session.get(Visitor, visitor_id)
    if not visitor:
        return jsonify({"error": "Not Found", "message": "Visitor record not found"}), 404

    # Delete snapshot from disk
    if visitor.snapshot_path:
        full_path = Config.BASE_DIR / visitor.snapshot_path.lstrip("/")
        if full_path.exists():
            try:
                os.remove(full_path)
            except OSError:
                pass

    db.session.delete(visitor)
    db.session.commit()

    return jsonify({"success": True, "message": "Visitor record and snapshot file deleted."}), 200

@visitors_bp.route("/export", methods=["GET"])
@login_required
def export_visitors_csv():
    """Exports filtered access records to a CSV file."""
    name_query = (request.args.get("name") or "").strip()
    status_filter = (request.args.get("status") or "").strip().lower()

    query = Visitor.query
    if name_query:
        query = query.filter(Visitor.name.ilike(f"%{name_query}%"))
    if status_filter in ["authorized", "unknown", "unrecognized"]:
        query = query.filter(Visitor.recognition_status == status_filter)

    records = query.order_by(Visitor.timestamp.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Event ID", 
        "Name / Subject", 
        "Recognition Status", 
        "Confidence Score", 
        "Event Timestamp (UTC)", 
        "Snapshot Path", 
        "Event Classification Note"
    ])

    for r in records:
        writer.writerow([
            r.id,
            r.name,
            r.recognition_status,
            f"{r.confidence:.2f}",
            r.timestamp.isoformat() if r.timestamp else "",
            r.snapshot_path or "No Snapshot",
            "Observed presence event (not door entry/exit)"
        ])

    csv_data = output.getvalue()
    timestamp_str = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"access_history_{timestamp_str}.csv"

    return Response(
        csv_data,
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
