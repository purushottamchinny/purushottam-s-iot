"""
Person Registration & Biometrics Management Blueprint
Handles face registration with strict validation, multi-sample embeddings,
listing, individual deletion, and purge of all biometric data.
"""

import os
import uuid
import base64
from datetime import datetime
from typing import Tuple, Optional, Dict, Any
import cv2
import numpy as np
from flask import Blueprint, request, jsonify
from backend.routes.auth import login_required
from backend.database.models import AuthorizedPerson, FaceSample
from backend.recognition.face_detector import FaceDetector
from backend.recognition.face_recognizer import FaceRecognizer
from backend.config import Config
from backend.extensions import db

persons_bp = Blueprint("persons", __name__, url_prefix="/api/person")

face_detector = FaceDetector()
face_recognizer = FaceRecognizer()

def _decode_image_from_request(req) -> Tuple[Optional[np.ndarray], Optional[str]]:
    """Decodes image from either multipart form upload or JSON base64."""
    # 1. Check multipart file upload
    if "image" in req.files:
        file = req.files["image"]
        if file and file.filename:
            file_bytes = np.frombuffer(file.read(), np.uint8)
            img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
            return img, file.filename

    # 2. Check JSON payload with base64 string
    data = req.get_json(silent=True) or {}
    image_b64 = data.get("image")
    if image_b64:
        if "base64," in image_b64:
            image_b64 = image_b64.split("base64,")[1]
        try:
            raw_bytes = base64.b64decode(image_b64)
            np_arr = np.frombuffer(raw_bytes, dtype=np.uint8)
            img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            return img, "capture.jpg"
        except Exception:
            return None, None

    return None, None

@persons_bp.route("/register", methods=["POST"])
@login_required
def register_person():
    """
    Registers a new authorized person or adds a new face sample to an existing person.
    Validates face criteria: exactly one face, size >= 60x60, minimum sharpness and brightness.
    """
    data = request.get_json(silent=True) or request.form
    name = (data.get("name") or "").strip()
    
    if not name:
        return jsonify({"error": "Bad Request", "message": "Name is required"}), 400

    image_bgr, filename = _decode_image_from_request(request)
    if image_bgr is None or image_bgr.size == 0:
        return jsonify({
            "error": "Bad Request", 
            "message": "Valid face image is required (upload file or webcam snapshot)"
        }), 400

    # Strict face validation
    quality_result, face_info = face_detector.validate_registration_image(image_bgr)
    if not quality_result.is_valid:
        return jsonify({
            "error": "Face Validation Failed",
            "message": quality_result.reason,
            "sharpness": quality_result.sharpness,
            "brightness": quality_result.brightness
        }), 422

    # Crop detected face region
    fx1, fy1, fx2, fy2 = face_info["box"]
    face_crop = image_bgr[fy1:fy2, fx1:fx2]

    # Extract embedding
    embedding = face_recognizer.extract_embedding(face_crop)
    if embedding is None:
        return jsonify({
            "error": "Feature Extraction Failed",
            "message": "Unable to compute face embedding. Please try another sample."
        }), 500

    # Save biometric image file securely
    unique_suffix = uuid.uuid4().hex[:8]
    save_filename = f"face_{int(datetime.utcnow().timestamp())}_{unique_suffix}.jpg"
    save_path = Config.CAPTURED_IMAGES_DIR / save_filename
    cv2.imwrite(str(save_path), face_crop, [cv2.IMWRITE_JPEG_QUALITY, 90])
    relative_img_path = f"/captured_images/{save_filename}"

    # Check if person already exists
    person = AuthorizedPerson.query.filter_by(name=name).first()
    if not person:
        person = AuthorizedPerson(name=name)
        db.session.add(person)
        db.session.flush()

    # Store embedding as binary float32 blob
    emb_blob = embedding.astype(np.float32).tobytes()
    sample = FaceSample(
        person_id=person.id,
        embedding=emb_blob,
        image_path=relative_img_path
    )
    db.session.add(sample)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": f"Successfully registered face sample for '{name}'.",
        "person": person.to_dict(),
        "quality": {
            "sharpness": quality_result.sharpness,
            "brightness": quality_result.brightness
        }
    }), 201

@persons_bp.route("/list", methods=["GET"])
@login_required
def list_persons():
    """Lists all registered authorized persons with sample counts. Embeddings are NEVER exposed."""
    persons = AuthorizedPerson.query.order_by(AuthorizedPerson.name.asc()).all()
    return jsonify({
        "persons": [p.to_dict() for p in persons],
        "total": len(persons)
    }), 200

@persons_bp.route("/<int:person_id>", methods=["DELETE"])
@login_required
def delete_person(person_id):
    """Deletes an authorized person and removes all associated face images from disk."""
    person = db.session.get(AuthorizedPerson, person_id)
    if not person:
        return jsonify({"error": "Not Found", "message": "Person not found"}), 404

    # Remove stored sample files
    for sample in person.samples:
        if sample.image_path:
            full_path = Config.BASE_DIR / sample.image_path.lstrip("/")
            if full_path.exists():
                try:
                    os.remove(full_path)
                except OSError:
                    pass

    person_name = person.name
    db.session.delete(person)
    db.session.commit()

    return jsonify({
        "success": True, 
        "message": f"Authorized person '{person_name}' and all associated biometric samples deleted."
    }), 200

@persons_bp.route("/biometrics/all", methods=["DELETE"])
@login_required
def delete_all_biometrics():
    """Safety feature: Deletes all biometric data (all embeddings and registered face images)."""
    persons = AuthorizedPerson.query.all()
    for p in persons:
        for sample in p.samples:
            if sample.image_path:
                full_path = Config.BASE_DIR / sample.image_path.lstrip("/")
                if full_path.exists():
                    try:
                        os.remove(full_path)
                    except OSError:
                        pass
        db.session.delete(p)

    db.session.commit()
    return jsonify({
        "success": True,
        "message": "All biometric embeddings and registered face images permanently erased."
    }), 200
