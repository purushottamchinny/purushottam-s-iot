"""
Application Configuration Module
Loads environment variables and sets defaults for security, database, camera, and AI services.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

import re
from typing import Any

def parse_float_val(val: Any, default: float) -> float:
    """Robustly parses a float from an env var or string that may contain comments or trailing text."""
    if val is None:
        return default
    if isinstance(val, (int, float)):
        return float(val)
    val_str = str(val).strip()
    match = re.search(r"[-+]?(?:\d*\.\d+|\d+)", val_str)
    if match:
        try:
            return float(match.group(0))
        except ValueError:
            return default
    return default

def parse_int_val(val: Any, default: int) -> int:
    """Robustly parses an int from an env var or string that may contain comments or trailing text."""
    if val is None:
        return default
    if isinstance(val, int):
        return val
    val_str = str(val).strip()
    match = re.search(r"[-+]?\d+", val_str)
    if match:
        try:
            return int(match.group(0))
        except ValueError:
            return default
    return default

def parse_bool_val(val: Any, default: bool = False) -> bool:
    """Parses boolean from env var or string."""
    if val is None:
        return default
    if isinstance(val, bool):
        return val
    val_str = str(val).strip().lower()
    if val_str in ("true", "1", "yes", "on", "y"):
        return True
    if val_str in ("false", "0", "no", "off", "n"):
        return False
    return default

def parse_database_url(url: Any, default: str) -> str:
    """Validates that DATABASE_URL is a legitimate SQLAlchemy URI; converts postgres:// to postgresql:// for Supabase compatibility."""
    if not url:
        return default
    url_str = str(url).strip()
    if url_str.startswith("postgres://"):
        url_str = "postgresql://" + url_str[len("postgres://"):]
    valid_prefixes = ("sqlite:///", "sqlite://", "postgresql://", "postgresql+psycopg2://", "mysql://", "mariadb://")
    if any(url_str.startswith(p) for p in valid_prefixes):
        return url_str
    return default

class Config:
    BASE_DIR = BASE_DIR
    SECRET_KEY = os.environ.get("SECRET_KEY", "smart-home-default-dev-secret-key-change-in-prod")
    
    # Database (validates URI, defaults to local SQLite)
    SQLALCHEMY_DATABASE_URI = parse_database_url(
        os.environ.get("DATABASE_URL"),
        f"sqlite:///{BASE_DIR / 'smart_home_security.db'}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Storage Directories
    CAPTURED_IMAGES_DIR = BASE_DIR / "captured_images"
    MODELS_DIR = BASE_DIR / "models"
    
    # Session & Security (Supports cross-site iframe embedding in AI Studio)
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "None"
    SESSION_COOKIE_SECURE = True
    PERMANENT_SESSION_LIFETIME = 86400 * 7  # 7 days
    
    # Camera Defaults (robust to inline comments like '0.50 initially, calibrate later')
    DEFAULT_CAMERA_INDEX = parse_int_val(os.environ.get("CAMERA_INDEX"), 0)
    DEFAULT_DETECTION_THRESHOLD = parse_float_val(os.environ.get("DETECTION_THRESHOLD"), 0.50)
    DEFAULT_RECOGNITION_THRESHOLD = parse_float_val(os.environ.get("RECOGNITION_THRESHOLD"), 0.60)
    DEFAULT_FRAME_INTERVAL = parse_int_val(os.environ.get("FRAME_INTERVAL"), 3)
    DEFAULT_COOLDOWN_SECONDS = parse_int_val(os.environ.get("COOLDOWN_SECONDS"), 45)
    DEFAULT_SOUND_ENABLED = parse_bool_val(os.environ.get("SOUND_ENABLED"), True)
    DEFAULT_RETENTION_DAYS = parse_int_val(os.environ.get("RETENTION_DAYS"), 30)
    
    # Gemini AI Defaults
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
    GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")
    DEFAULT_GEMINI_ENABLED = parse_bool_val(os.environ.get("GEMINI_ENABLED"), False)
    
    # Validation Boundaries for SystemSettings
    LIMITS = {
        "detection_threshold": (0.1, 0.95),
        "recognition_threshold": (0.3, 0.95),
        "frame_interval": (1, 30),
        "cooldown_seconds": (5, 600),
        "retention_days": (1, 365),
        "camera_index": (0, 10),
    }

# Ensure storage directories exist
os.makedirs(Config.CAPTURED_IMAGES_DIR, exist_ok=True)
os.makedirs(Config.MODELS_DIR, exist_ok=True)
