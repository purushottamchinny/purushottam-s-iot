"""
Database Initialization & Maintenance Helpers
Creates tables, seeds initial SystemSettings, and provides maintenance routines.
"""

import os
from datetime import datetime, timedelta
from backend.extensions import db
from backend.database.models import SystemSettings, Admin, Visitor, SecurityAlert
from backend.config import Config

def init_db(app):
    """Initializes tables and ensures default settings exist."""
    with app.app_context():
        db.create_all()
        # Seed default SystemSettings if table is empty
        settings = SystemSettings.query.first()
        if not settings:
            settings = SystemSettings(
                camera_index=Config.DEFAULT_CAMERA_INDEX,
                detection_threshold=Config.DEFAULT_DETECTION_THRESHOLD,
                recognition_threshold=Config.DEFAULT_RECOGNITION_THRESHOLD,
                frame_interval=Config.DEFAULT_FRAME_INTERVAL,
                cooldown_seconds=Config.DEFAULT_COOLDOWN_SECONDS,
                sound_enabled=Config.DEFAULT_SOUND_ENABLED,
                gemini_enabled=Config.DEFAULT_GEMINI_ENABLED,
                retention_days=Config.DEFAULT_RETENTION_DAYS
            )
            db.session.add(settings)
            db.session.commit()
            print("[Database] Initialized default SystemSettings.")

        # Seed default Admin if no admin exists
        admin = Admin.query.first()
        if not admin:
            admin_user = (os.environ.get("ADMIN_USERNAME") or "admin").strip()
            admin_pwd = (os.environ.get("ADMIN_PASSWORD") or "Admin12345!").strip()
            admin = Admin(username=admin_user)
            admin.set_password(admin_pwd)
            db.session.add(admin)
            db.session.commit()
            print(f"[Database] Seeded initial admin account: '{admin_user}'")

def get_system_settings() -> SystemSettings:
    """Retrieves current system settings or initializes default."""
    settings = SystemSettings.query.first()
    if not settings:
        settings = SystemSettings(
            camera_index=Config.DEFAULT_CAMERA_INDEX,
            detection_threshold=Config.DEFAULT_DETECTION_THRESHOLD,
            recognition_threshold=Config.DEFAULT_RECOGNITION_THRESHOLD,
            frame_interval=Config.DEFAULT_FRAME_INTERVAL,
            cooldown_seconds=Config.DEFAULT_COOLDOWN_SECONDS,
            sound_enabled=Config.DEFAULT_SOUND_ENABLED,
            gemini_enabled=Config.DEFAULT_GEMINI_ENABLED,
            retention_days=Config.DEFAULT_RETENTION_DAYS
        )
        db.session.add(settings)
        db.session.commit()
    return settings

def purge_expired_records_and_snapshots(retention_days: int = None) -> int:
    """Deletes visitor snapshots and records older than retention_days."""
    if retention_days is None:
        settings = get_system_settings()
        retention_days = settings.retention_days
        
    cutoff = datetime.utcnow() - timedelta(days=retention_days)
    expired_visitors = Visitor.query.filter(Visitor.timestamp < cutoff).all()
    count = len(expired_visitors)
    
    for v in expired_visitors:
        if v.snapshot_path and os.path.exists(v.snapshot_path):
            try:
                os.remove(v.snapshot_path)
            except OSError:
                pass
        db.session.delete(v)
        
    if count > 0:
        db.session.commit()
        print(f"[Maintenance] Cleaned {count} records older than {retention_days} days.")
    return count
