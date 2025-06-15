import numpy as np
import tensorflow as tf
import cv2
from ..config import SEQUENCE_LENGTH
import time

class ViolenceDetector:
    def __init__(self, model_path: str, input_size: tuple[int, int]):
        self.model = tf.keras.models.load_model(model_path)
        self.input_size = input_size
        self.frame_buffer = []
        self.max_frames = SEQUENCE_LENGTH

    def add_frame(self, frame: np.ndarray) -> None:
        resized = cv2.resize(frame, self.input_size)
        normalized = resized / 255.0
        self.frame_buffer.append(normalized)

        if len(self.frame_buffer) > self.max_frames:
            self.frame_buffer.pop(0)

    def predict_sequence(self) -> dict:
        start_time = time.time()
        frames_collected = len(self.frame_buffer)

        if frames_collected < self.max_frames:
            return {
                "isViolent": False,
                "confidence": 0.5,
                "inference_time_ms": 0.0,
                "frames_collected": frames_collected,
                "max_frames": self.max_frames,
                "ready": False
            }

        try:
            sequence = np.array([self.frame_buffer])
            prediction = self.model.predict(sequence, verbose=0)
            prediction_idx = np.argmax(prediction[0])
            is_violent = prediction_idx == 1
            confidence = float(prediction[0][prediction_idx])
            inference_time = (time.time() - start_time) * 1000

            return {
                "isViolent": bool(is_violent),
                "confidence": float(confidence),
                "inference_time_ms": float(inference_time),
                "frames_collected": int(frames_collected),
                "max_frames": int(self.max_frames),
                "ready": True
            }

        except Exception as e:
            from app.core.logger import logger
            logger.exception("Model prediction failed")
            return {
                "isViolent": False,
                "confidence": 0.5,
                "inference_time_ms": 0.0,
                "error": str(e),
                "frames_collected": frames_collected,
                "max_frames": self.max_frames,
                "ready": False
            }
