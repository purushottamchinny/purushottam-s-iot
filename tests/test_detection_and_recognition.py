"""
Tests for Detection, Tracking, and Face Recognition Logic
Covers:
- YOLO Person Detector
- Centroid / IoU Tracking
- Face Detector Quality Validation (no-face, small face, blurry)
- Cosine Similarity & Embedding Extraction
- 3-State Access Classification (Authorized, Unknown, Unrecognized)
- Cooldown and Consensus Voting (prevents duplicate visitor events)
"""

import numpy as np
import cv2
from backend.detection.person_detector import PersonDetector
from backend.detection.tracker import PersonTracker, calculate_iou
from backend.recognition.face_detector import FaceDetector
from backend.recognition.face_recognizer import (
    FaceRecognizer, cosine_similarity, STATUS_AUTHORIZED, STATUS_UNKNOWN, STATUS_UNRECOGNIZED
)
from backend.services.logging_service import LoggingService
from backend.database.models import SystemSettings

def create_synthetic_face_image(sharpness: float = 100.0) -> np.ndarray:
    """Generates a synthetic 200x200 image with face-like structures for test purposes."""
    img = np.ones((200, 200, 3), dtype=np.uint8) * 180
    # Head contour
    cv2.circle(img, (100, 100), 60, (140, 140, 140), -1)
    # Eyes
    cv2.circle(img, (80, 85), 10, (50, 50, 50), -1)
    cv2.circle(img, (120, 85), 10, (50, 50, 50), -1)
    # Mouth
    cv2.ellipse(img, (100, 125), (25, 12), 0, 0, 180, (50, 50, 50), 3)
    return img

def test_iou_calculation():
    boxA = [10, 10, 50, 50]
    boxB = [10, 10, 50, 50]
    assert calculate_iou(boxA, boxB) == 1.0

    boxC = [100, 100, 150, 150]
    assert calculate_iou(boxA, boxC) == 0.0

    boxD = [30, 30, 70, 70]
    iou = calculate_iou(boxA, boxD)
    assert 0.0 < iou < 1.0

def test_person_detector_initialization():
    detector = PersonDetector()
    assert detector is not None
    # Test on a blank frame
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    detections = detector.detect(frame)
    assert isinstance(detections, list)

def test_face_detector_rejects_empty_and_no_face():
    detector = FaceDetector()
    # Blank black image has no face
    blank = np.zeros((200, 200, 3), dtype=np.uint8)
    quality, face = detector.validate_registration_image(blank)
    assert quality.is_valid is False
    assert "No face detected" in quality.reason

def test_face_recognizer_cosine_similarity():
    # Exactly identical vectors
    vec1 = np.array([1.0, 2.0, 3.0, 4.0], dtype=np.float32)
    vec2 = np.array([1.0, 2.0, 3.0, 4.0], dtype=np.float32)
    assert round(cosine_similarity(vec1, vec2), 4) == 1.0

    # Orthogonal vectors
    vec3 = np.array([1.0, 0.0], dtype=np.float32)
    vec4 = np.array([0.0, 1.0], dtype=np.float32)
    assert round(cosine_similarity(vec3, vec4), 4) == 0.0

    # Opposite vectors
    vec5 = np.array([1.0, 1.0], dtype=np.float32)
    vec6 = np.array([-1.0, -1.0], dtype=np.float32)
    assert round(cosine_similarity(vec5, vec6), 4) == -1.0

def test_three_state_recognition_classification():
    recognizer = FaceRecognizer(recognition_threshold=0.60)
    
    # Generate mock 128-dim embedding
    emb_alice = np.random.randn(128).astype(np.float32)
    emb_alice = emb_alice / np.linalg.norm(emb_alice)

    registered = [{
        "id": 1,
        "name": "Alice Resident",
        "embeddings": [emb_alice]
    }]

    # 1. Matching Alice's embedding -> AUTHORIZED
    quality_good = {"sharpness": 80.0, "brightness": 120.0, "box": [10, 10, 90, 90]}
    status, name, pid, conf = recognizer.compare_with_database(emb_alice, registered, quality_good)
    assert status == STATUS_AUTHORIZED
    assert name == "Alice Resident"
    assert pid == 1
    assert conf >= 0.99

    # 2. Completely different clear face -> UNKNOWN VISITOR
    emb_unknown = np.random.randn(128).astype(np.float32)
    emb_unknown = emb_unknown / np.linalg.norm(emb_unknown)
    # Ensure low correlation
    while cosine_similarity(emb_alice, emb_unknown) > 0.30:
        emb_unknown = np.random.randn(128).astype(np.float32)
        emb_unknown = emb_unknown / np.linalg.norm(emb_unknown)

    status_u, name_u, pid_u, conf_u = recognizer.compare_with_database(emb_unknown, registered, quality_good)
    assert status_u == STATUS_UNKNOWN
    assert name_u == "Unknown Visitor"
    assert pid_u is None

    # 3. Blurry or low-quality face crop -> FACE NOT RECOGNIZED
    quality_blurry = {"sharpness": 12.0, "brightness": 120.0, "box": [10, 10, 90, 90]}
    status_r, name_r, pid_r, conf_r = recognizer.compare_with_database(emb_unknown, registered, quality_blurry)
    assert status_r == STATUS_UNRECOGNIZED
    assert name_r == "Face Not Recognized"

def test_cooldown_and_voting_consensus(app, client):
    logging_svc = LoggingService(consecutive_frames_required=3)
    settings = SystemSettings(
        camera_index=0,
        detection_threshold=0.5,
        recognition_threshold=0.6,
        frame_interval=3,
        cooldown_seconds=45,
        sound_enabled=True,
        gemini_enabled=False,
        retention_days=30
    )

    frame = np.zeros((200, 200, 3), dtype=np.uint8)
    track = {
        "track_id": 99,
        "box": [10, 10, 90, 90],
        "recognition_votes": []
    }

    # Vote 1 and 2: Not yet reached required consensus count (3)
    track["recognition_votes"].append(("authorized", "Alice", 0.95, 1))
    res1 = logging_svc.process_track_event(track, frame, settings, app)
    assert res1 is None

    track["recognition_votes"].append(("authorized", "Alice", 0.95, 1))
    res2 = logging_svc.process_track_event(track, frame, settings, app)
    assert res2 is None

    # Vote 3: 3 consecutive votes agree -> Event logged
    track["recognition_votes"].append(("authorized", "Alice", 0.95, 1))
    res3 = logging_svc.process_track_event(track, frame, settings, app)
    assert res3 is not None
    assert res3["name"] == "Alice"
    assert res3["recognition_status"] == "authorized"

    # Vote 4: Consecutive votes agree but COOLDOWN active -> returns None (NO duplicate record)
    track["recognition_votes"].append(("authorized", "Alice", 0.95, 1))
    res4 = logging_svc.process_track_event(track, frame, settings, app)
    assert res4 is None, "Cooldown must prevent duplicate log records"
