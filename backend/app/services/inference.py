import numpy as np
import cv2
from ..core.model import ViolenceDetector
from ..config import MODEL_PATH, IMAGE_WIDTH, IMAGE_HEIGHT

# Singleton model instance
model = ViolenceDetector(MODEL_PATH, (IMAGE_HEIGHT, IMAGE_WIDTH))

def handle_frame(data: bytes) -> tuple[dict, bool]:
    frame = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    
    if frame is None:
        return {"error": "Invalid frame received"}, False
    
    model.add_frame(frame)
    prediction = model.predict_sequence()
    return prediction, True
