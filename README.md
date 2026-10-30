# Smart Home Monitoring and Access Monitoring System
### Using Artificial Intelligence & Computer Vision (with optional Google Gemini Assistant)

[![Python](https://img.shields.io/badge/Python-3.11-blue.svg)](https://www.python.org/)
[![OpenCV](https://img.shields.io/badge/OpenCV-4.10-green.svg)](https://opencv.org/)
[![YOLO](https://img.shields.io/badge/YOLO-v8n-yellow.svg)](https://ultralytics.com/)
[![InsightFace](https://img.shields.io/badge/InsightFace-buffalo__s-orange.svg)](https://insightface.ai/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

---

## 1. Project Overview

This project is an intelligent home security monitoring system built for local execution on personal computers (specifically tested and optimized for Apple Silicon M1 Pro / macOS, as well as Linux environments). It accesses the built-in webcam or USB camera to:

1. **Detect human presence** in real-time using Ultralytics YOLOv8 (COCO class 0: `person`).
2. **Track distinct individuals** across frames using Centroid and IoU (Intersection-over-Union) tracking.
3. **Validate and recognize faces** using InsightFace with ONNX Runtime, computing cosine similarity against stored biometric embeddings:
   - **AUTHORIZED**: Confirmed match against registered resident ($\ge$ threshold, e.g. 60%).
   - **UNKNOWN VISITOR**: Clear, well-lit face with no authorized match (triggers snapshot & alert).
   - **FACE NOT RECOGNIZED**: Blurry, distant, or partial face crop (specifically does **not** trigger false alarms).
4. **Prevent alert storms** using an N-frame consensus vote (default: 3 frames) and configurable cooldown per person (default: 45s).
5. **Enforce strict privacy**: All biometric embeddings and image snapshots stay strictly on the local machine and are never exposed via APIs.
6. **Optional Gemini AI Layer**: Leverages Google Gemini free tier (`gemini-3.8-flash`) to generate neutral 1-2 sentence descriptions of unknown visitor snapshots, answer natural-language security questions grounded in local database statistics, and generate executive activity reports.

> **Important Boundary**: This system **observes presence events only**. It does not control physical doors, locks, or gates, and never claims to.

---

## 2. Directory Structure

```text
smart-home-monitoring/
├── backend/
│   ├── app.py                      # Flask & SocketIO application entry point
│   ├── config.py                   # Centralized configuration & environment loader
│   ├── extensions.py               # Shared SQLAlchemy and SocketIO instances
│   ├── camera/
│   │   ├── camera_manager.py       # Thread-safe singleton webcam manager & MJPEG streamer
│   │   └── video_stream.py         # Video streaming generator helpers
│   ├── detection/
│   │   ├── person_detector.py      # YOLOv8 / HOG person detection
│   │   └── tracker.py              # Centroid & IoU multi-person tracker
│   ├── recognition/
│   │   ├── face_detector.py        # Face detection & registration quality validator
│   │   └── face_recognizer.py      # Feature embedding extractor & cosine similarity matcher
│   ├── database/
│   │   ├── db.py                   # Database initialization and retention cleanup helpers
│   │   └── models.py               # SQLAlchemy models (Admin, AuthorizedPerson, FaceSample, Visitor, SecurityAlert, SystemSettings)
│   ├── routes/
│   │   ├── auth.py                 # Login, session status, logout, and rate-limiting
│   │   ├── camera.py               # Camera start/stop, status, feed, and frame ingestion
│   │   ├── persons.py              # Face registration, listing, and biometrics erasure
│   │   ├── visitors.py             # Access history, status/date filters, and CSV export
│   │   ├── alerts.py               # Security alerts retrieval and review workflow
│   │   ├── dashboard.py            # Aggregated database metrics and 7-day timeline series
│   │   ├── settings.py             # System parameters and range validation
│   │   └── assistant.py            # Gemini AI chat and executive report endpoints
│   └── services/
│       ├── monitoring_service.py   # Main pipeline orchestrator and HUD renderer
│       ├── alert_service.py        # Snapshot saving and Socket.IO alert dispatcher
│       ├── logging_service.py      # Presence event logger, consensus voting & cooldowns
│       └── gemini_service.py       # Optional Gemini AI async descriptions & grounded chat
├── frontend/                       # Standalone vanilla HTML5/CSS/JS frontend
│   ├── index.html
│   ├── login.html
│   ├── style.css
│   └── script.js
├── src/                            # Modern interactive React dashboard
│   ├── components/                 # Modular dashboard, camera, history, and settings views
│   ├── App.tsx
│   └── main.tsx
├── captured_images/                # Local storage for alert snapshots and face samples
├── models/                         # Local storage for YOLO and InsightFace weights
├── scripts/
│   ├── init_db.py                  # Database creation and defaults setup
│   └── create_admin.py             # Secure admin user creation script
├── tests/
│   ├── conftest.py                 # Pytest test fixtures and in-memory test database
│   ├── test_auth_and_security.py   # Auth, session, and rate-limiting tests
│   ├── test_detection_and_recognition.py # AI detection, tracking, cosine similarity, voting tests
│   └── test_api_endpoints.py       # REST API, CSV export, and settings validation tests
├── requirements.txt                # Pinned, tested Python dependencies
├── .env.example                    # Template environment variables
├── .gitignore                      # Excludes .env, *.db, snapshots, and weight files
└── README.md                       # Comprehensive documentation
```

---

## 3. Installation Guide (macOS Apple Silicon & Linux)

### Prerequisites
- **Operating System**: macOS 12+ (Apple Silicon M1/M2/M3) or Linux (Ubuntu 22.04+).
- **Python**: Python 3.11 installed (recommended via Homebrew on macOS: `brew install python@3.11`).
- **Node.js**: v18+ (if running the React dev dashboard).

### Step 1: Clone and Set Up Virtual Environment
```bash
git clone <repository_url>
cd smart-home-monitoring

# Create and activate Python 3.11 virtual environment
python3.11 -m venv venv
source venv/bin/activate
```

### Step 2: Install Python Dependencies
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 3: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Open `.env` and configure:
```ini
SECRET_KEY="generate-a-random-32-byte-hex-string"
DATABASE_URL="sqlite:///smart_home_security.db"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="YourSecurePassword123!"

# Optional: Google Gemini Free Tier
GEMINI_API_KEY=""
GEMINI_MODEL="gemini-3.8-flash"
GEMINI_ENABLED="false"
```

### Step 4: Initialize Database and Create Admin User
```bash
python scripts/init_db.py
python scripts/create_admin.py --username admin --password "YourSecurePassword123!"
```

---

## 4. Camera Permissions on macOS

On macOS, terminal applications and Python require explicit camera permissions:
1. Open **System Settings > Privacy & Security > Camera**.
2. Ensure **Terminal**, **iTerm2**, or your code editor (e.g., VS Code) has camera access toggled **ON**.
3. If prompted with *"Terminal would like to access the camera"*, click **Allow**.

---

## 5. Running the Application

### Option A: Complete Full-Stack Dashboard (Port 3000)
Runs the modern responsive React dashboard with both browser webcam capture and backend proxying:
```bash
npm run dev
```
Open your browser to: **`http://localhost:3000`**

### Option B: Standalone Python Flask Backend (Port 5001)
Runs the pure Python backend and serves the standalone HTML5/CSS/JS frontend directly:
```bash
python backend/app.py
```
Open your browser to: **`http://localhost:5001`**

---

## 6. How to Set Up the Optional Free Google Gemini API

1. Visit [Google AI Studio](https://aistudio.google.com/).
2. Click **Get API Key** and create a key in your project.
3. Paste the key into your `.env` file:
   ```ini
   GEMINI_API_KEY="AIzaSy..."
   GEMINI_MODEL="gemini-3.8-flash"
   GEMINI_ENABLED="true"
   ```
4. In the app's **Settings** panel, enable **Google Gemini AI Integration** and click **Save Settings**.
5. When an unknown visitor alert is created, the system will automatically call Gemini asynchronously to generate a neutral 1-2 sentence scene description (e.g., *"One person standing by the entryway wearing a jacket, daytime lighting"*).

---

## 7. Automated Testing Suite

The repository includes a comprehensive 16-test suite covering authentication, YOLO person detection, centroid tracking, face detection quality validation, cosine similarity, 3-state classification, voting consensus, cooldown prevention, and REST APIs.

Run tests:
```bash
PYTHONPATH=. pytest -v tests/
```

Expected output:
```text
============================== 16 passed in 2.65s ==============================
```

---

## 8. Step-by-Step Demonstration Guide

1. **Sign In**: Navigate to `http://localhost:3000` (or `http://localhost:5001`) and log in with your admin credentials.
2. **Register Authorized Face**:
   - Navigate to the **Face Registration** tab.
   - Enter your name (e.g., *"Alex"*).
   - Use the live webcam capture to take 2-3 photos of your face.
   - Notice the quality validation metrics (sharpness variance, brightness, single-face check).
   - Click **Validate & Store Embedding**.
3. **Test Authorized Recognition**:
   - Open **Live Monitoring**.
   - Stand in front of the camera. The bounding box will turn **Emerald Green** with the label `AUTHORIZED: Alex (xx%)`.
   - Check **Dashboard** to see the authorized visitor count increment by 1.
4. **Test Unknown Visitor Detection**:
   - Have an unregistered person appear in front of the camera (or hold a photo of an unrecognized person).
   - The bounding box turns **Rose Red** with the label `UNKNOWN VISITOR`.
   - A security alert is generated and pushed via Socket.IO, and a snapshot is saved to `captured_images/`.
5. **Review Alert**:
   - Navigate to **Security Alerts** and click **Mark Reviewed**.
6. **Test Gemini Assistant**:
   - Navigate to **AI Assistant**.
   - Click the chip *"How many unknown visitors were observed today?"*.
   - View the grounded natural-language response.
7. **Export Access History**:
   - Navigate to **Access History** and click **Export to CSV**.

---

## 9. Known Limitations

- **Lighting & Angles**: Extreme backlighting or steep side angles (>45 degrees) may reduce facial feature matching accuracy.
- **Accessories**: Heavy sunglasses, surgical masks, or deep hoods obscure biometric facial landmarks.
- **Liveness / Anti-Spoofing**: This baseline implementation relies on optical camera frames. To prevent photo spoofing in high-security commercial installations, an IR depth sensor or active challenge-response liveness detection should be added.
- **Door Control**: The system is designed strictly for **presence observation** and does not actuate physical locks.

---

## 10. License & Ethics

Distributed under the Apache 2.0 License. This software must only be operated in environments where monitoring is legally compliant and where occupants have been notified.
