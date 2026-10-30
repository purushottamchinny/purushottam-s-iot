"""
Pytest Test Fixtures and Test App Configuration
Configures an isolated SQLite in-memory database and test client.
"""

import os
import pytest
from backend.app import create_app
from backend.extensions import db
from backend.database.models import Admin, AuthorizedPerson, FaceSample, Visitor, SecurityAlert, SystemSettings

@pytest.fixture(scope="session")
def app():
    test_config = {
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "SECRET_KEY": "test-secret-key-smart-home",
        "WTF_CSRF_ENABLED": False,
    }
    app = create_app(test_config=test_config)
    yield app

@pytest.fixture
def client(app):
    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            # Seed test admin
            admin = Admin.query.filter_by(username="testadmin").first()
            if not admin:
                admin = Admin(username="testadmin")
                admin.set_password("TestSecret123!")
                db.session.add(admin)
                db.session.commit()
        yield client
        with app.app_context():
            db.drop_all()

@pytest.fixture
def authenticated_client(client):
    """Client already logged in as testadmin."""
    res = client.post("/api/login", json={
        "username": "testadmin",
        "password": "TestSecret123!"
    })
    assert res.status_code == 200
    return client
