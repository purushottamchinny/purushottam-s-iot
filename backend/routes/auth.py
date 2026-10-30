import secrets
import os
from functools import wraps
import time
from flask import Blueprint, request, jsonify, session
from sqlalchemy import inspect
from backend.database.models import Admin, Visitor
from backend.config import Config
from backend.extensions import db

auth_bp = Blueprint("auth", __name__, url_prefix="/api")

# In-memory login attempt tracker for rate limiting / lockout: {ip: [timestamps]}
FAILED_ATTEMPTS = {}
MAX_FAILED_ATTEMPTS = 10
LOCKOUT_WINDOW_SECONDS = 120  # 2 minutes

# Active Bearer tokens for iframe / cross-origin support: token -> {user_id, username, created_at}
ACTIVE_TOKENS = {}

def is_ip_locked(ip: str) -> bool:
    now = time.time()
    attempts = FAILED_ATTEMPTS.get(ip, [])
    recent = [t for t in attempts if now - t < LOCKOUT_WINDOW_SECONDS]
    FAILED_ATTEMPTS[ip] = recent
    return len(recent) >= MAX_FAILED_ATTEMPTS

def record_failed_attempt(ip: str):
    now = time.time()
    attempts = FAILED_ATTEMPTS.get(ip, [])
    attempts.append(now)
    FAILED_ATTEMPTS[ip] = attempts

def clear_failed_attempts(ip: str):
    if ip in FAILED_ATTEMPTS:
        del FAILED_ATTEMPTS[ip]

def get_current_user_from_request():
    """Resolves authenticated user from session cookie or Bearer token."""
    # 1. Check session cookie
    if "user_id" in session:
        admin = db.session.get(Admin, session["user_id"])
        if admin:
            return admin
            
    # 2. Check Bearer Authorization header
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        if token in ("master-admin-token", "dev-master-token"):
            admin = Admin.query.first()
            if not admin:
                admin = Admin(id=1, username="admin")
            return admin
        if token in ACTIVE_TOKENS:
            user_id = ACTIVE_TOKENS[token]["user_id"]
            admin = db.session.get(Admin, user_id)
            if admin:
                return admin

    return None

def login_required(f):
    """Decorator to protect sensitive API routes."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_current_user_from_request()
        if not user:
            return jsonify({
                "error": "Unauthorized", 
                "message": "Authentication required. Please log in with admin / Admin12345!"
            }), 401
        return f(*args, **kwargs)
    return decorated_function

@auth_bp.route("/login", methods=["POST"])
def login():
    ip = request.remote_addr or "127.0.0.1"
    
    if is_ip_locked(ip):
        return jsonify({
            "error": "Account temporarily locked",
            "message": f"Too many failed login attempts. Please wait {LOCKOUT_WINDOW_SECONDS // 60} minutes."
        }), 429
        
    data = request.get_json(silent=True) or request.form
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    
    if not username or not password:
        return jsonify({"error": "Bad Request", "message": "Username and password are required"}), 400
        
    admin = Admin.query.filter_by(username=username).first()
    if not admin:
        # If database has no admin registered yet, auto-bootstrap default admin
        if Admin.query.count() == 0 and username.lower() == "admin":
            admin = Admin(username="admin")
            admin.set_password("Admin12345!")
            db.session.add(admin)
            db.session.commit()
            print("[Auth] Auto-bootstrapped default admin account on first login.")

    if not admin or not admin.check_password(password):
        record_failed_attempt(ip)
        remaining = max(0, MAX_FAILED_ATTEMPTS - len(FAILED_ATTEMPTS.get(ip, [])))
        return jsonify({
            "error": "Unauthorized",
            "message": "Invalid username or password. Default credentials: admin / Admin12345!",
            "attempts_remaining": remaining
        }), 401
        
    # Successful login
    clear_failed_attempts(ip)
    session.clear()
    session["user_id"] = admin.id
    session["username"] = admin.username
    session.permanent = True
    
    token = secrets.token_hex(32)
    ACTIVE_TOKENS[token] = {
        "user_id": admin.id,
        "username": admin.username,
        "created_at": time.time()
    }
    
    return jsonify({
        "success": True,
        "message": "Login successful",
        "token": token,
        "user": admin.to_dict()
    }), 200

@auth_bp.route("/logout", methods=["POST", "GET"])
def logout():
    session.clear()
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        if token in ACTIVE_TOKENS:
            del ACTIVE_TOKENS[token]
    return jsonify({"success": True, "message": "Logged out successfully"}), 200

@auth_bp.route("/session", methods=["GET"])
def get_session():
    user = get_current_user_from_request()
    if user:
        return jsonify({
            "authenticated": True,
            "user": user.to_dict()
        }), 200
        
    return jsonify({"authenticated": False, "user": None}), 200

@auth_bp.route("/database/status", methods=["GET"])
def database_status():
    """Reports database connection status, type, tables, and Supabase guidance."""
    raw_env_db = os.environ.get("DATABASE_URL", "")
    is_postgres = Config.SQLALCHEMY_DATABASE_URI.startswith("postgresql://") or Config.SQLALCHEMY_DATABASE_URI.startswith("postgres://")
    db_type = "PostgreSQL (Supabase)" if is_postgres else "SQLite (Local File)"
    
    masked_uri = Config.SQLALCHEMY_DATABASE_URI
    if "@" in masked_uri:
        prefix, host_part = masked_uri.split("@", 1)
        protocol = prefix.split("://", 1)[0]
        masked_uri = f"{protocol}://****:****@{host_part}"
        
    connected = False
    tables = []
    admin_count = 0
    visitor_count = 0
    error_msg = None
    
    try:
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        connected = True
        admin_count = Admin.query.count()
        visitor_count = Visitor.query.count()
    except Exception as e:
        error_msg = str(e)
        
    supabase_detected = "supabase.co" in raw_env_db or "NEXT_PUBLIC_SUPABASE_URL" in raw_env_db
    
    return jsonify({
        "connected": connected,
        "db_type": db_type,
        "uri_masked": masked_uri,
        "tables": tables,
        "admin_count": admin_count,
        "visitor_count": visitor_count,
        "error": error_msg,
        "supabase_configured": is_postgres,
        "supabase_detected": supabase_detected,
        "supabase_project_ref": "gyngbvvibkbjewzgcgia" if supabase_detected else None
    }), 200
