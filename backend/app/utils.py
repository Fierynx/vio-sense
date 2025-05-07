import cv2
import numpy as np

def decode_frame_to_rgb(image_bytes: bytes) -> np.ndarray:
    """
    Decode JPEG/PNG bytes into an RGB numpy array.
    """
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    # Decode to BGR image
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    # Convert BGR to RGB
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    return rgb


def preprocess_frame(frame: np.ndarray, target_size: tuple[int, int]) -> np.ndarray:
    """
    Resize and normalize frame for model input.
    """
    # Resize frame
    resized_frame = cv2.resize(frame, target_size)
    # Scale pixels to [0,1]
    normalized_frame = resized_frame.astype(np.float32) / 255.0
    # Add batch dimension
    return normalized_frame