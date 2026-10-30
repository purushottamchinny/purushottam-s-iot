"""
YOLO Person Detector Module
Detects persons in images/video frames using Ultralytics YOLO (COCO class 0: person).
Features graceful initialization, configurable confidence threshold, and inference timing.
"""

import time
import os
from pathlib import Path
from typing import List, Dict, Any, Tuple
import cv2
import numpy as np
from backend.config import Config

class PersonDetector:
    def __init__(self, model_name: str = "yolov8n.pt", conf_threshold: float = 0.50):
        self.conf_threshold = conf_threshold
        self.model_name = model_name
        self.model_path = Config.MODELS_DIR / model_name
        self.model = None
        self.backend_type = "none"
        self.last_inference_time_ms = 0.0
        self._init_model()

    def _init_model(self):
        """Attempts to load Ultralytics YOLOv8/v11; falls back to OpenCV HOG/DNN if needed."""
        # 1. Try loading via Ultralytics YOLO
        try:
            from ultralytics import YOLO
            # If model file is in models/ use it, otherwise download to models/
            target = str(self.model_path) if self.model_path.exists() else self.model_name
            self.model = YOLO(target)
            self.backend_type = "ultralytics"
            print(f"[PersonDetector] Loaded Ultralytics YOLO model '{self.model_name}' successfully.")
            return
        except Exception as e:
            print(f"[PersonDetector] Ultralytics YOLO direct load deferred or unavailable ({e}). Initializing robust computer vision detector.")

        # 2. Fallback: OpenCV HOG Person Detector (pre-trained pedestrian/person SVM built into OpenCV)
        try:
            self.hog = cv2.HOGDescriptor()
            self.hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
            self.backend_type = "opencv_hog"
            print("[PersonDetector] Initialized OpenCV HOG Person Detector fallback.")
        except Exception as e:
            print(f"[PersonDetector] Error initializing fallback detector: {e}")
            self.backend_type = "none"

    def detect(self, frame_bgr: np.ndarray, conf_threshold: float = None) -> List[Dict[str, Any]]:
        """
        Runs person detection on a single frame.
        Returns list of detected person bounding boxes and confidence scores:
        [{"box": [x1, y1, x2, y2], "confidence": float, "class": "person"}]
        """
        if frame_bgr is None or frame_bgr.size == 0:
            return []

        threshold = conf_threshold if conf_threshold is not None else self.conf_threshold
        start_t = time.perf_counter()
        detections = []
        h, w = frame_bgr.shape[:2]

        if self.backend_type == "ultralytics" and self.model is not None:
            try:
                # classes=[0] filters to COCO class 0 ("person") only
                results = self.model(frame_bgr, conf=threshold, classes=[0], verbose=False)
                for r in results:
                    boxes = r.boxes
                    for box in boxes:
                        cls_id = int(box.cls[0].item())
                        if cls_id == 0:  # person
                            conf = float(box.conf[0].item())
                            xyxy = box.xyxy[0].cpu().numpy().astype(int)
                            x1 = max(0, int(xyxy[0]))
                            y1 = max(0, int(xyxy[1]))
                            x2 = min(w - 1, int(xyxy[2]))
                            y2 = min(h - 1, int(xyxy[3]))
                            if x2 > x1 and y2 > y1:
                                detections.append({
                                    "box": [x1, y1, x2, y2],
                                    "confidence": round(conf, 3),
                                    "class": "person"
                                })
            except Exception as e:
                # Fallback to HOG if YOLO throws an error during inference
                detections = self._detect_hog(frame_bgr, threshold)
        elif self.backend_type == "opencv_hog":
            detections = self._detect_hog(frame_bgr, threshold)

        self.last_inference_time_ms = round((time.perf_counter() - start_t) * 1000.0, 1)
        return detections

    def _detect_hog(self, frame_bgr: np.ndarray, threshold: float) -> List[Dict[str, Any]]:
        detections = []
        h, w = frame_bgr.shape[:2]
        try:
            # Resize image slightly for speed if large
            scale = 1.0
            resized = frame_bgr
            if w > 800:
                scale = 800.0 / w
                resized = cv2.resize(frame_bgr, (800, int(h * scale)))

            boxes, weights = self.hog.detectMultiScale(
                resized, 
                winStride=(8, 8), 
                padding=(16, 16), 
                scale=1.05
            )
            for (bx, by, bw, bh), weight in zip(boxes, weights):
                conf = float(weight[0]) if hasattr(weight, '__iter__') else float(weight)
                # Map confidence to 0.0 - 1.0 range
                norm_conf = min(1.0, max(0.4, 0.5 + conf * 0.1))
                if norm_conf >= threshold:
                    x1 = max(0, int(bx / scale))
                    y1 = max(0, int(by / scale))
                    x2 = min(w - 1, int((bx + bw) / scale))
                    y2 = min(h - 1, int((by + bh) / scale))
                    detections.append({
                        "box": [x1, y1, x2, y2],
                        "confidence": round(norm_conf, 3),
                        "class": "person"
                    })
        except Exception:
            pass
        return detections
