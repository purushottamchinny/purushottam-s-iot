"""
Tests for REST API Endpoints and Workflows
Covers:
- Camera API
- Person Registration and Listing
- Visitors History & CSV Export
- Alert Review Workflow
- Dashboard Analytics
- Settings Validation Boundaries
- Gemini Assistant Graceful Fallback
"""

import json
from backend.database.models import Visitor, SecurityAlert, AuthorizedPerson, SystemSettings
from backend.extensions import db

def test_camera_status_and_controls(authenticated_client):
    status_res = authenticated_client.get("/api/camera/status")
    assert status_res.status_code == 200
    assert "is_running" in status_res.get_json()

    # Stop camera
    stop_res = authenticated_client.post("/api/camera/stop")
    assert stop_res.status_code == 200
    assert stop_res.get_json()["success"] is True

def test_settings_validation_ranges(authenticated_client):
    # Valid update
    valid_res = authenticated_client.put("/api/settings", json={
        "detection_threshold": 0.65,
        "cooldown_seconds": 60,
        "sound_enabled": True
    })
    assert valid_res.status_code == 200
    assert valid_res.get_json()["settings"]["detection_threshold"] == 0.65
    assert valid_res.get_json()["settings"]["cooldown_seconds"] == 60

    # Invalid update (out of bounds)
    invalid_res = authenticated_client.put("/api/settings", json={
        "detection_threshold": 1.5,  # Max is 0.95
        "cooldown_seconds": 2        # Min is 5
    })
    assert invalid_res.status_code == 422
    assert "detection_threshold" in invalid_res.get_json()["fields"]
    assert "cooldown_seconds" in invalid_res.get_json()["fields"]

def test_visitors_and_csv_export(authenticated_client, app):
    with app.app_context():
        # Seed test visitors
        v1 = Visitor(name="Alice Resident", recognition_status="authorized", confidence=0.92)
        v2 = Visitor(name="Unknown Visitor", recognition_status="unknown", confidence=0.88)
        db.session.add_all([v1, v2])
        db.session.commit()

    # List visitors
    list_res = authenticated_client.get("/api/visitors")
    assert list_res.status_code == 200
    data = list_res.get_json()
    assert data["total"] >= 2
    assert any(v["name"] == "Alice Resident" for v in data["visitors"])

    # Filter by status
    filter_res = authenticated_client.get("/api/visitors?status=unknown")
    assert filter_res.status_code == 200
    for v in filter_res.get_json()["visitors"]:
        assert v["recognition_status"] == "unknown"

    # CSV Export
    csv_res = authenticated_client.get("/api/visitors/export")
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.content_type
    csv_text = csv_res.data.decode("utf-8")
    assert "Event ID" in csv_text
    assert "Alice Resident" in csv_text

def test_alert_lifecycle_and_review(authenticated_client, app):
    with app.app_context():
        v = Visitor(name="Unknown Visitor", recognition_status="unknown", confidence=0.85)
        db.session.add(v)
        db.session.flush()
        alert = SecurityAlert(visitor_id=v.id, alert_type="unrecognized_person", status="new")
        db.session.add(alert)
        db.session.commit()
        alert_id = alert.id

    # List alerts
    list_res = authenticated_client.get("/api/alerts?status=new")
    assert list_res.status_code == 200
    assert list_res.get_json()["total"] >= 1

    # Review alert
    review_res = authenticated_client.patch(f"/api/alerts/{alert_id}/review")
    assert review_res.status_code == 200
    assert review_res.get_json()["alert"]["status"] == "reviewed"

def test_dashboard_stats_consistency(authenticated_client, app):
    res = authenticated_client.get("/api/dashboard/stats")
    assert res.status_code == 200
    stats = res.get_json()["stats"]
    assert "total_detections" in stats
    assert "authorized_count" in stats
    assert "unknown_count" in stats
    assert "unreviewed_alerts" in stats

def test_gemini_fallback_when_disabled(authenticated_client):
    # Assistant fallback
    res = authenticated_client.post("/api/assistant/ask", json={
        "question": "How many visitors came today?"
    })
    assert res.status_code == 200
    data = res.get_json()
    assert "answer" in data
    assert len(data["answer"]) > 0

    # Summary report fallback
    rep_res = authenticated_client.get("/api/reports/summary?period=daily")
    assert rep_res.status_code == 200
    rep_data = rep_res.get_json()
    assert "report" in rep_data
    assert "Security Activity Summary" in rep_data["report"]

def test_env_var_robust_parsing_and_comments():
    from backend.config import parse_float_val, parse_int_val, parse_bool_val
    # Test strings with inline comments or trailing text (like '0.50 initially, calibrate later')
    assert parse_float_val("0.50 initially, calibrate later", 0.60) == 0.50
    assert parse_float_val("0.75 # recommended", 0.60) == 0.75
    assert parse_float_val(0.85, 0.60) == 0.85
    assert parse_float_val("invalid", 0.60) == 0.60
    assert parse_float_val(None, 0.60) == 0.60

    assert parse_int_val("45 seconds", 30) == 45
    assert parse_int_val("0 (built-in webcam)", 1) == 0
    assert parse_int_val(10, 5) == 10
    assert parse_int_val(None, 3) == 3

    assert parse_bool_val("true", False) is True
    assert parse_bool_val("false", True) is False
    assert parse_bool_val("1", False) is True
    assert parse_bool_val("0", True) is False

