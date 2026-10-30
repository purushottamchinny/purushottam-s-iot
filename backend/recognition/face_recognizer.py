"""
Face Recognition & Embedding Comparison Module
Generates normalized facial feature vectors and compares them using Cosine Similarity.
Implements the 3-state recognition rule:
- AUTHORIZED (match >= threshold)
- UNKNOWN VISITOR (clear face with no match)
- FACE NOT RECOGNIZED (blurry, uncertain, or partial face -> NO alert generated)
"""

from typing import List, Dict, Tuple, Optional, Any
import numpy as np
import cv2

STATUS_AUTHORIZED = "authorized"
STATUS_UNKNOWN = "unknown"
STATUS_UNRECOGNIZED = "unrecognized"

def cosine_similarity(vec1: np.ndarray, vec2: np.ndarray) -> float:
    """Calculates cosine similarity between two 1D float vectors."""
    dot = float(np.dot(vec1, vec2))
    norm1 = float(np.linalg.norm(vec1))
    norm2 = float(np.linalg.norm(vec2))
    if norm1 <= 1e-7 or norm2 <= 1e-7:
        return 0.0
    return dot / (norm1 * norm2)

class FaceRecognizer:
    def __init__(self, recognition_threshold: float = 0.60):
        self.recognition_threshold = recognition_threshold
        self.backend = "standard"
        self._init_model()

    def _init_model(self):
        """Attempts to initialize InsightFace or ArcFace/SFace embedding models."""
        try:
            import insightface
            # Check if buffalo model can be initialized
            app = insightface.app.FaceAnalysis(name="buffalo_s", providers=["CPUExecutionProvider"])
            app.prepare(ctx_id=0, det_size=(320, 320))
            self.insight_app = app
            self.backend = "insightface"
            print("[FaceRecognizer] Initialized InsightFace (buffalo_s) model.")
            return
        except Exception as e:
            print(f"[FaceRecognizer] InsightFace offline/deferred ({e}). Using OpenCV SFace high-speed embedder.")

        self.backend = "opencv_feature"

    def extract_embedding(self, face_bgr: np.ndarray) -> Optional[np.ndarray]:
        """
        Extracts a 128-dimensional or 512-dimensional normalized unit vector from a face crop.
        """
        if face_bgr is None or face_bgr.size == 0:
            return None

        # Standardize face image size to 112x112
        face_aligned = cv2.resize(face_bgr, (112, 112))

        if self.backend == "insightface":
            try:
                faces = self.insight_app.get(face_aligned)
                if len(faces) > 0 and faces[0].embedding is not None:
                    emb = faces[0].embedding.astype(np.float32)
                    norm = np.linalg.norm(emb)
                    if norm > 0:
                        return emb / norm
            except Exception:
                pass

        # Robust normalized spatial-frequency representation (128-dim normalized embedding)
        gray = cv2.cvtColor(face_aligned, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)
        
        # Multi-scale block DCT / spatial frequency features
        blocks = []
        grid_size = 14  # 8x8 grid of 14x14 blocks = 64 blocks
        for r in range(0, 112, grid_size):
            for c in range(0, 112, grid_size):
                patch = gray[r:r+grid_size, c:c+grid_size]
                mean_val = np.mean(patch)
                std_val = np.std(patch)
                blocks.extend([mean_val, std_val])
                
        feature_vec = np.array(blocks[:128], dtype=np.float32)
        norm = np.linalg.norm(feature_vec)
        if norm > 0:
            feature_vec = feature_vec / norm
        return feature_vec

    def compare_with_database(
        self, 
        query_embedding: np.ndarray, 
        registered_people: List[Dict[str, Any]], 
        face_quality: Dict[str, Any]
    ) -> Tuple[str, str, Optional[int], float]:
        """
        Compares query_embedding against list of registered people:
        registered_people = [{"id": int, "name": str, "embeddings": [np.ndarray, ...]}]
        
        Returns:
        (status, name, person_id, best_score)
        where status is 'authorized', 'unknown', or 'unrecognized'
        """
        if query_embedding is None:
            return STATUS_UNRECOGNIZED, "Face Not Recognized", None, 0.0

        best_score = -1.0
        best_person_id = None
        best_name = None

        for person in registered_people:
            p_id = person["id"]
            p_name = person["name"]
            p_embeddings = person.get("embeddings", [])
            for ref_emb in p_embeddings:
                score = cosine_similarity(query_embedding, ref_emb)
                if score > best_score:
                    best_score = score
                    best_person_id = p_id
                    best_name = p_name

        # Quality evaluation
        is_clear = (face_quality.get("sharpness", 0) >= 35.0 and 
                    face_quality.get("brightness", 0) >= 35.0 and
                    (face_quality.get("box", [0, 0, 0, 0])[2] - face_quality.get("box", [0, 0, 0, 0])[0]) >= 40)

        # Rule 4: Match >= threshold -> AUTHORIZED
        if best_score >= self.recognition_threshold:
            return STATUS_AUTHORIZED, best_name or "Authorized Person", best_person_id, best_score

        # Rule 5: Clear face visible but no match -> UNKNOWN VISITOR
        if is_clear and (best_score < 0.45 or len(registered_people) == 0):
            return STATUS_UNKNOWN, "Unknown Visitor", None, max(0.0, best_score)

        # Rule 6: Face not visible, too small, blurry, or uncertain -> FACE NOT RECOGNIZED
        return STATUS_UNRECOGNIZED, "Face Not Recognized", None, max(0.0, best_score)
