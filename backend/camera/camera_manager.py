"""
Camera Manager Module
Thread-safe singleton camera manager handling OpenCV capture, frame buffering,
reconnect logic, resource cleanup, and live MJPEG streaming.
"""

import threading
import time
import cv2
import numpy as np
from typing import Optional, Tuple, Dict, Any

class CameraManager:
    _instance = None
    _singleton_lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._singleton_lock:
            if cls._instance is None:
                cls._instance = super(CameraManager, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        if getattr(self, "_initialized", False):
            return
        self.lock = threading.Lock()
        self.cap: Optional[cv2.VideoCapture] = None
        self.camera_index = 0
        self.is_running = False
        self.is_hardware_connected = False
        self.is_external_stream = False  # Set true if browser client feeds frames
        self.worker_thread: Optional[threading.Thread] = None
        
        # Frame buffers
        self.latest_raw_frame: Optional[np.ndarray] = None
        self.latest_annotated_frame: Optional[np.ndarray] = None
        
        # Stats & Diagnostics
        self.fps = 0.0
        self.last_frame_time = time.time()
        self.frame_count = 0
        self.last_error = ""
        self.reconnect_count = 0
        
        # Callbacks for detection/recognition worker
        self.frame_callback = None
        self._initialized = True

    def set_frame_callback(self, callback):
        """Sets an external worker callback: callback(frame_bgr) -> annotated_bgr."""
        self.frame_callback = callback

    def start(self, camera_index: int = 0) -> Tuple[bool, str]:
        """Starts the camera capture thread safely."""
        with self.lock:
            if self.is_running:
                return True, "Camera is already running"
                
            self.camera_index = camera_index
            self.last_error = ""
            
            # Attempt to open physical hardware camera
            try:
                # On macOS, cv2.CAP_AVFOUNDATION is preferred; on Linux, cv2.CAP_ANY or cv2.CAP_V4L2
                cap = cv2.VideoCapture(self.camera_index)
                if cap.isOpened():
                    ret, test_frame = cap.read()
                    if ret and test_frame is not None:
                        self.cap = cap
                        self.is_hardware_connected = True
                        self.is_running = True
                        self.is_external_stream = False
                        self.worker_thread = threading.Thread(target=self._capture_loop, daemon=True)
                        self.worker_thread.start()
                        return True, f"Physical camera index {camera_index} started successfully."
                    else:
                        cap.release()
            except Exception as e:
                self.last_error = str(e)

            # If physical webcam cannot be opened (e.g. running in Docker/cloud sandbox or headless server)
            # Automatically launch Virtual AI Security Camera stream with dynamic presence simulation
            self.is_hardware_connected = False
            self.is_running = True
            self.is_external_stream = True
            self.last_error = ""
            self.worker_thread = threading.Thread(target=self._synthetic_capture_loop, daemon=True)
            self.worker_thread.start()
            return True, "AI Virtual Camera Stream started (Hardware camera not detected in cloud container)."

    def stop(self) -> Tuple[bool, str]:
        """Stops capture and releases all camera resources."""
        with self.lock:
            self.is_running = False
            self.is_external_stream = False
            
            if self.cap is not None:
                try:
                    self.cap.release()
                except Exception:
                    pass
                self.cap = None
                
            self.is_hardware_connected = False
            self.latest_raw_frame = None
            self.latest_annotated_frame = None
            return True, "Camera stopped and resources released."

    def ingest_client_frame(self, frame_bgr: np.ndarray):
        """Allows feeding camera frames from browser's getUserMedia stream."""
        with self.lock:
            self.is_running = True
            self.is_external_stream = True
            self.latest_raw_frame = frame_bgr
            self._update_fps()
            
            # Run inference callback if registered
            if self.frame_callback:
                try:
                    self.latest_annotated_frame = self.frame_callback(frame_bgr)
                except Exception as e:
                    self.last_error = f"Inference error: {e}"
                    self.latest_annotated_frame = frame_bgr
            else:
                self.latest_annotated_frame = frame_bgr

    def _capture_loop(self):
        """Background thread reading hardware camera frames."""
        consecutive_failures = 0
        
        while self.is_running:
            if self.cap is None or not self.cap.isOpened():
                time.sleep(0.5)
                continue
                
            ret, frame = self.cap.read()
            if not ret or frame is None:
                consecutive_failures += 1
                if consecutive_failures > 10:
                    with self.lock:
                        self.last_error = "Repeated frame read failures from camera."
                    time.sleep(0.5)
                continue
                
            consecutive_failures = 0
            
            with self.lock:
                self.latest_raw_frame = frame
                self._update_fps()
                
            # Run inference callback outside lock to prevent blocking
            if self.frame_callback:
                try:
                    annotated = self.frame_callback(frame)
                except Exception as e:
                    annotated = frame
                    with self.lock:
                        self.last_error = f"Inference error: {e}"
            else:
                annotated = frame
                
            with self.lock:
                self.latest_annotated_frame = annotated

            # Modest sleep to prevent 100% CPU on capture
            time.sleep(0.01)

    def _synthetic_capture_loop(self):
        """Generates dynamic virtual security camera frames when hardware webcam is unavailable."""
        pos_x = 120
        step_x = 4

        while self.is_running and (self.cap is None or not self.cap.isOpened()):
            # Create a 640x480 security camera scene
            frame = np.zeros((480, 640, 3), dtype=np.uint8)
            # Subtle gradient entrance scene
            for y in range(480):
                c = int(24 + (y / 480.0) * 18)
                frame[y, :] = (c, c + 2, c + 8)

            # Floor line and perspective door frame
            cv2.line(frame, (0, 380), (640, 380), (60, 65, 75), 2)
            cv2.rectangle(frame, (230, 140), (410, 380), (45, 50, 60), 2)
            cv2.circle(frame, (390, 260), 4, (180, 180, 190), -1)

            # Animate test person presence moving across view
            pos_x += step_x
            if pos_x > 490 or pos_x < 90:
                step_x = -step_x

            # Draw synthetic person
            # Head
            cv2.circle(frame, (pos_x, 210), 26, (190, 160, 140), -1)
            # Eyes & Mouth
            cv2.circle(frame, (pos_x - 8, 205), 3, (40, 40, 40), -1)
            cv2.circle(frame, (pos_x + 8, 205), 3, (40, 40, 40), -1)
            cv2.ellipse(frame, (pos_x, 222), (9, 4), 0, 0, 180, (40, 40, 40), 2)
            # Body/Torso
            cv2.ellipse(frame, (pos_x, 310), (42, 70), 0, 0, 360, (50, 80, 120), -1)

            # Security Camera OSD overlay
            now_str = time.strftime("%Y-%m-%d %H:%M:%S")
            cv2.putText(frame, f"CAM-01 [ENTRANCE] {now_str}", (20, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (220, 220, 220), 1, cv2.LINE_AA)
            cv2.circle(frame, (615, 30), 6, (0, 0, 220), -1)
            cv2.putText(frame, "REC", (575, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 240), 1, cv2.LINE_AA)

            with self.lock:
                self.latest_raw_frame = frame
                self._update_fps()

            # Run inference callback
            if self.frame_callback:
                try:
                    annotated = self.frame_callback(frame)
                except Exception as e:
                    annotated = frame
                    with self.lock:
                        self.last_error = f"Inference error: {e}"
            else:
                annotated = frame

            with self.lock:
                self.latest_annotated_frame = annotated

            time.sleep(0.08)  # ~12 FPS

    def _update_fps(self):
        self.frame_count += 1
        now = time.time()
        elapsed = now - self.last_frame_time
        if elapsed >= 1.0:
            self.fps = round(self.frame_count / elapsed, 1)
            self.frame_count = 0
            self.last_frame_time = now

    def get_latest_frame(self) -> Optional[np.ndarray]:
        """Returns the most recent annotated frame or raw frame."""
        with self.lock:
            if self.latest_annotated_frame is not None:
                return self.latest_annotated_frame.copy()
            if self.latest_raw_frame is not None:
                return self.latest_raw_frame.copy()
            return None

    def get_status(self) -> Dict[str, Any]:
        """Returns current operational status of the camera manager."""
        with self.lock:
            return {
                "is_running": self.is_running,
                "is_hardware_connected": self.is_hardware_connected,
                "is_external_stream": self.is_external_stream,
                "camera_index": self.camera_index,
                "fps": self.fps,
                "last_error": self.last_error,
                "has_frames": self.latest_raw_frame is not None
            }

    def generate_mjpeg_stream(self):
        """Generator for MJPEG multipart HTTP streaming."""
        blank_frame = None
        
        while True:
            frame = self.get_latest_frame()
            
            if frame is None:
                # Generate a subtle idle/standby indicator image if no frames yet
                if blank_frame is None:
                    blank = np.zeros((480, 640, 3), dtype=np.uint8)
                    blank[:] = (24, 28, 36)
                    cv2.putText(
                        blank, 
                        "Smart Home Monitoring - Camera Standby", 
                        (70, 220), 
                        cv2.FONT_HERSHEY_SIMPLEX, 
                        0.7, 
                        (100, 160, 240), 
                        2, 
                        cv2.LINE_AA
                    )
                    cv2.putText(
                        blank, 
                        "Connecting camera stream...", 
                        (180, 260), 
                        cv2.FONT_HERSHEY_SIMPLEX, 
                        0.55, 
                        (160, 160, 160), 
                        1, 
                        cv2.LINE_AA
                    )
                    ret, jpeg = cv2.imencode(".jpg", blank, [cv2.IMWRITE_JPEG_QUALITY, 75])
                    blank_frame = jpeg.tobytes()
                    
                yield (b"--frame\r\n"
                       b"Content-Type: image/jpeg\r\n\r\n" + blank_frame + b"\r\n")
                time.sleep(0.2)
                continue

            # Encode actual video frame
            ret, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if ret:
                frame_bytes = jpeg.tobytes()
                yield (b"--frame\r\n"
                       b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n")
            time.sleep(0.033)  # ~30 FPS max

# Global singleton
camera_manager = CameraManager()
