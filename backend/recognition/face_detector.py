"""
Face Detection and Quality Assessment Module
Locates faces in images or person crops, validates quality (size, sharpness, brightness),
and rejects non-compliant or multiple-face images.
"""

from typing import List, Dict, Any, Tuple, Optional
import cv2
import numpy as np

class FaceQualityResult:
    def __init__(self, is_valid: bool, reason: str = "", sharpness: float = 0.0, brightness: float = 0.0):
        self.is_valid = is_valid
        self.reason = reason
        self.sharpness = sharpness
        self.brightness = brightness

class FaceDetector:
    def __init__(self, min_face_size: int = 40, min_sharpness: float = 35.0):
        self.min_face_size = min_face_size
        self.min_sharpness = min_sharpness
        self._init_detector()

    def _init_detector(self):
        """Initializes OpenCV Haar Cascade and YuNet face detector."""
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        self.face_cascade = cv2.CascadeClassifier(cascade_path)

    def detect_faces(self, frame_bgr: np.ndarray) -> List[Dict[str, Any]]:
        """
        Detects all faces in frame_bgr.
        Returns list of dicts: [{"box": [x1, y1, x2, y2], "confidence": float, "sharpness": float, "brightness": float}]
        """
        if frame_bgr is None or frame_bgr.size == 0:
            return []

        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        h, w = frame_bgr.shape[:2]

        # Equalize histogram slightly for better detection in varying lighting
        gray_eq = cv2.equalizeHist(gray)

        faces = self.face_cascade.detectMultiScale(
            gray_eq,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(self.min_face_size, self.min_face_size)
        )

        detected = []
        for (fx, fy, fw, fh) in faces:
            x1 = max(0, int(fx))
            y1 = max(0, int(fy))
            x2 = min(w - 1, int(fx + fw))
            y2 = min(h - 1, int(fy + fh))

            face_roi_gray = gray[y1:y2, x1:x2]
            if face_roi_gray.size == 0:
                continue

            # Quality metrics
            sharpness = float(cv2.Laplacian(face_roi_gray, cv2.CV_64F).var())
            brightness = float(np.mean(face_roi_gray))

            detected.append({
                "box": [x1, y1, x2, y2],
                "confidence": 0.85,
                "sharpness": round(sharpness, 1),
                "brightness": round(brightness, 1)
            })

        return detected

    def validate_registration_image(self, image_bgr: np.ndarray) -> Tuple[FaceQualityResult, Optional[Dict[str, Any]]]:
        """
        Validates an image submitted for face registration:
        - Image format & dimensions
        - Exactly one face
        - Minimum face size
        - Acceptable sharpness & brightness
        """
        if image_bgr is None or image_bgr.size == 0:
            return FaceQualityResult(False, "Invalid or unreadable image file"), None

        h, w = image_bgr.shape[:2]
        if h < 100 or w < 100:
            return FaceQualityResult(False, "Image resolution too low (minimum 100x100)"), None

        faces = self.detect_faces(image_bgr)
        if len(faces) == 0:
            return FaceQualityResult(False, "No face detected in image. Please ensure your face is clearly visible and well-lit."), None

        if len(faces) > 1:
            return FaceQualityResult(False, f"Multiple faces detected ({len(faces)}). Exactly one face is required for registration."), None

        face = faces[0]
        fx1, fy1, fx2, fy2 = face["box"]
        fw, fh = fx2 - fx1, fy2 - fy1

        if fw < 60 or fh < 60:
            return FaceQualityResult(False, "Face is too small in the frame (minimum 60x60 px). Please move closer."), None

        if face["sharpness"] < self.min_sharpness:
            return FaceQualityResult(False, f"Face image is too blurry (sharpness score {face['sharpness']}, minimum {self.min_sharpness}). Please hold still."), None

        if face["brightness"] < 35:
            return FaceQualityResult(False, "Image is too dark. Please improve ambient lighting."), None

        if face["brightness"] > 235:
            return FaceQualityResult(False, "Image is overexposed or too bright."), None

        return FaceQualityResult(True, "Face meets all quality criteria", face["sharpness"], face["brightness"]), face
