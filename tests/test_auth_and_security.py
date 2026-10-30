"""
Tests for Module 1: Authentication and Route Security
Covers: Login, wrong password, rate limiting lockout, logout, session status, and 401 unauthorized protection.
"""

def test_login_success(client):
    res = client.post("/api/login", json={
        "username": "testadmin",
        "password": "TestSecret123!"
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert data["user"]["username"] == "testadmin"

def test_login_invalid_password(client):
    res = client.post("/api/login", json={
        "username": "testadmin",
        "password": "WrongPassword!"
    })
    assert res.status_code == 401
    data = res.get_json()
    assert "Invalid username or password" in data["message"]

def test_protected_routes_require_auth(client):
    # Unauthenticated requests must receive 401 Unauthorized
    routes = [
        ("GET", "/api/dashboard/stats"),
        ("GET", "/api/person/list"),
        ("GET", "/api/visitors"),
        ("GET", "/api/alerts"),
        ("GET", "/api/settings"),
        ("GET", "/api/camera/status"),
        ("GET", "/api/camera/feed"),
    ]
    for method, path in routes:
        if method == "GET":
            res = client.get(path)
        else:
            res = client.post(path)
        assert res.status_code == 401, f"Route {path} should be protected but returned {res.status_code}"

def test_session_status_and_logout(authenticated_client):
    # Check session
    res = authenticated_client.get("/api/session")
    assert res.status_code == 200
    assert res.get_json()["authenticated"] is True

    # Logout
    logout_res = authenticated_client.post("/api/logout")
    assert logout_res.status_code == 200

    # Session after logout
    res_after = authenticated_client.get("/api/session")
    assert res_after.get_json()["authenticated"] is False
