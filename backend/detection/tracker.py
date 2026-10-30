"""
Person Tracker Module
Maintains consistent identity tracks for detected persons using Centroid & IoU matching.
Prevents duplicate events and supports cooldown calculation.
"""

import time
from typing import List, Dict, Tuple, Any
import numpy as np

def calculate_iou(boxA, boxB) -> float:
    # box format: [x1, y1, x2, y2]
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])

    interArea = max(0, xB - xA) * max(0, yB - yA)
    boxAArea = max(0, boxA[2] - boxA[0]) * max(0, boxA[3] - boxA[1])
    boxBArea = max(0, boxB[2] - boxB[0]) * max(0, boxB[3] - boxB[1])
    denom = float(boxAArea + boxBArea - interArea)
    if denom <= 0:
        return 0.0
    return interArea / denom

class PersonTracker:
    def __init__(self, max_disappeared: int = 15, iou_threshold: float = 0.3):
        self.next_track_id = 1
        self.tracks: Dict[int, Dict[str, Any]] = {}  # {track_id: {box, centroid, disappeared, last_seen, recognition_history, last_logged_time}}
        self.max_disappeared = max_disappeared
        self.iou_threshold = iou_threshold

    def update(self, detected_boxes: List[List[int]]) -> Dict[int, Dict[str, Any]]:
        """
        Updates tracks with newly detected bounding boxes [x1, y1, x2, y2].
        Returns mapping of track_id -> track_info.
        """
        now = time.time()
        
        # If no boxes detected, increment disappeared counter for all active tracks
        if len(detected_boxes) == 0:
            to_delete = []
            for tid in list(self.tracks.keys()):
                self.tracks[tid]["disappeared"] += 1
                if self.tracks[tid]["disappeared"] > self.max_disappeared:
                    to_delete.append(tid)
            for tid in to_delete:
                del self.tracks[tid]
            return self.tracks

        # If no tracks exist, register all detections as new
        if len(self.tracks) == 0:
            for box in detected_boxes:
                self._register(box, now)
            return self.tracks

        # Match existing tracks with detected boxes using IoU
        track_ids = list(self.tracks.keys())
        track_boxes = [self.tracks[tid]["box"] for tid in track_ids]

        iou_matrix = np.zeros((len(track_ids), len(detected_boxes)), dtype=np.float32)
        for i, tbox in enumerate(track_boxes):
            for j, dbox in enumerate(detected_boxes):
                iou_matrix[i, j] = calculate_iou(tbox, dbox)

        # Greedy match based on highest IoU
        matched_tracks = set()
        matched_detections = set()

        if iou_matrix.size > 0:
            flat_indices = np.argsort(-iou_matrix, axis=None)
            for idx in flat_indices:
                row = idx // iou_matrix.shape[1]
                col = idx % iou_matrix.shape[1]
                if row in matched_tracks or col in matched_detections:
                    continue
                if iou_matrix[row, col] >= self.iou_threshold:
                    matched_tracks.add(row)
                    matched_detections.add(col)
                    tid = track_ids[row]
                    box = detected_boxes[col]
                    self.tracks[tid]["box"] = box
                    self.tracks[tid]["centroid"] = ((box[0] + box[2]) // 2, (box[1] + box[3]) // 2)
                    self.tracks[tid]["disappeared"] = 0
                    self.tracks[tid]["last_seen"] = now

        # Unmatched tracks
        for i, tid in enumerate(track_ids):
            if i not in matched_tracks:
                self.tracks[tid]["disappeared"] += 1
                if self.tracks[tid]["disappeared"] > self.max_disappeared:
                    del self.tracks[tid]

        # Unmatched detections -> new tracks
        for j, box in enumerate(detected_boxes):
            if j not in matched_detections:
                self._register(box, now)

        return self.tracks

    def _register(self, box: List[int], timestamp: float):
        centroid = ((box[0] + box[2]) // 2, (box[1] + box[3]) // 2)
        self.tracks[self.next_track_id] = {
            "track_id": self.next_track_id,
            "box": box,
            "centroid": centroid,
            "disappeared": 0,
            "first_seen": timestamp,
            "last_seen": timestamp,
            "last_logged_time": 0.0,
            "recognition_votes": [],  # list of (status, name, conf)
            "confirmed_status": None,
            "confirmed_name": None,
        }
        self.next_track_id += 1
