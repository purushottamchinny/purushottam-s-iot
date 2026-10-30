"""
Main Application Entry Point (Flask + SocketIO)
Assembles blueprints, establishes camera & monitoring callbacks,
and configures real-time event streaming and static asset serving.
"""

import os
import sys
import atexit
from pathlib import Path

# Ensure project root is in sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from flask import Flask, send_from_directory, jsonify, session, redirect, url_for
from flask_cors import CORS

from backend.config import Config
from backend.extensions import db, socketio
from backend.database.db import init_db
from backend.camera.camera_manager import camera_manager
from backend.services.monitoring_service import monitoring_service

# Import blueprints
from backend.routes.auth import auth_bp
from backend.routes.camera import camera_bp
from backend.routes.persons import persons_bp
from backend.routes.visitors import visitors_bp
from backend.routes.alerts import alerts_bp
from backend.routes.dashboard import dashboard_bp
from backend.routes.settings import settings_bp
from backend.routes.assistant import assistant_bp

def create_app(test_config=None) -> Flask:
    app = Flask(
        __name__, 
        static_folder=str(Config.BASE_DIR / "frontend"), 
        static_url_path="/static"
    )
    
    if test_config:
        app.config.from_mapping(test_config)
    else:
        app.config.from_object(Config)

    # Enable CORS for local dev & frontend clients
    CORS(app, supports_credentials=True, origins="*")

    # Initialize extensions
    db.init_app(app)
    socketio.init_app(app, cors_allowed_origins="*")

    # Wire up monitoring service and camera manager callback
    monitoring_service.init_app(app)
    camera_manager.set_frame_callback(monitoring_service.process_frame)

    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(camera_bp)
    app.register_blueprint(persons_bp)
    app.register_blueprint(visitors_bp)
    app.register_blueprint(alerts_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(assistant_bp)

    # Static routes for snapshots
    @app.route("/captured_images/<path:filename>")
    def serve_snapshot(filename):
        return send_from_directory(Config.CAPTURED_IMAGES_DIR, filename)

    # Standalone HTML frontend routes (for direct Flask local execution)
    frontend_dir = Config.BASE_DIR / "frontend"

    @app.route("/")
    def index():
        if "user_id" not in session:
            login_file = frontend_dir / "login.html"
            if login_file.exists():
                return send_from_directory(frontend_dir, "login.html")
        index_file = frontend_dir / "index.html"
        if index_file.exists():
            return send_from_directory(frontend_dir, "index.html")
        return jsonify({
            "system": "Smart Home Monitoring API",
            "status": "operational",
            "docs": "/api/dashboard/stats"
        })

    @app.route("/login")
    def login_page():
        login_file = frontend_dir / "login.html"
        if login_file.exists():
            return send_from_directory(frontend_dir, "login.html")
        return redirect("/")

    # Socket.IO Event Handlers
    @socketio.on("connect")
    def handle_connect():
        socketio.emit("camera_status", camera_manager.get_status())

    @socketio.on("disconnect")
    def handle_disconnect():
        pass

    # Ensure camera is released on process termination
    atexit.register(lambda: camera_manager.stop())

    # Create tables and seed initial settings
    with app.app_context():
        init_db(app)

    return app

if __name__ == "__main__":
    app = create_app()
    port = int(os.environ.get("PORT", 5001))
    host = os.environ.get("HOST", "0.0.0.0")
    print(f"\n=======================================================")
    print(f" Smart Home Monitoring Backend Starting on {host}:{port}")
    print(f" SQLite Database: {Config.SQLALCHEMY_DATABASE_URI}")
    print(f"=======================================================\n")
    socketio.run(app, host=host, port=port, debug=False, allow_unsafe_werkzeug=True)
