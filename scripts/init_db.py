#!/usr/bin/env python3
"""
Database Setup Script
Initializes SQLite database tables and default system settings.
"""

import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from flask import Flask
from backend.config import Config
from backend.extensions import db
from backend.database.db import init_db

def main():
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    
    print("[Init DB] Setting up database tables and defaults...")
    init_db(app)
    print("[Init DB] Database ready at:", Config.SQLALCHEMY_DATABASE_URI)

if __name__ == "__main__":
    main()
