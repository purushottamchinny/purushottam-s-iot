"""
Video Stream Utility
Provides generator functions and MJPEG header utilities for HTTP streaming.
"""

from backend.camera.camera_manager import camera_manager

def get_mjpeg_stream_generator():
    """Returns the generator stream from camera_manager."""
    return camera_manager.generate_mjpeg_stream()
