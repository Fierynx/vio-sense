import tensorflow as tf
import numpy as np

class ViolenceDetector:
    def __init__(self, model_path: str, input_size: tuple[int, int]):
        """
        Load the TensorFlow model once at startup.
        model_path: path to saved .h5 or SavedModel directory
        input_size: (width, height) expected by the model
        """
        self.model = tf.keras.models.load_model(model_path)
        self.input_size = input_size
    
    def predict_sequence(self, seq: np.ndarray) -> dict:
        """
        Run inference on a sequence of frames
        """
        prob = self.model.predict(seq)[0]
        print("Prob: ", prob)
        predicted_label = np.argmax(prob)
        print("Predicted label: ", predicted_label)
        return {
            "isViolent": bool(predicted_label == 1),
            "confidence": float(prob[predicted_label]),
        }