#!/usr/bin/env python3
"""
Admin User Creation Script
Creates or updates an admin user with securely hashed passwords.
Can be run via CLI arguments, environment variables, or interactive prompt.
"""

import sys
import argparse
import os
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from flask import Flask
from backend.config import Config
from backend.extensions import db
from backend.database.models import Admin

def create_or_update_admin(username, password):
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    
    with app.app_context():
        db.create_all()
        admin = Admin.query.filter_by(username=username).first()
        if admin:
            admin.set_password(password)
            db.session.commit()
            print(f"[Admin] Password updated successfully for user '{username}'.")
        else:
            admin = Admin(username=username)
            admin.set_password(password)
            db.session.add(admin)
            db.session.commit()
            print(f"[Admin] Admin user '{username}' created successfully.")

def main():
    parser = argparse.ArgumentParser(description="Create or update smart home system admin account.")
    parser.add_argument("--username", "-u", default=os.environ.get("ADMIN_USERNAME", "admin"), help="Admin username")
    parser.add_argument("--password", "-p", default=os.environ.get("ADMIN_PASSWORD", ""), help="Admin password")
    args = parser.parse_args()
    
    username = args.username.strip()
    password = args.password.strip()
    
    if not password:
        import getpass
        password = getpass.getpass("Enter admin password: ")
        
    if len(password) < 6:
        print("[Error] Password must be at least 6 characters long.", file=sys.stderr)
        sys.exit(1)
        
    create_or_update_admin(username, password)

if __name__ == "__main__":
    main()
