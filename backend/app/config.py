import os
# Configuration via environment (with sensible defaults)
MODEL_PATH      = os.getenv("MODEL_PATH", "../models/MobileNetV2_BiLSTM_best.h5")
IMAGE_WIDTH     = int(os.getenv("IMAGE_WIDTH", "224"))
IMAGE_HEIGHT    = int(os.getenv("IMAGE_HEIGHT", "224"))
SEQUENCE_LENGTH = int(os.getenv("SEQ_LEN", "16"))
FRONTEND_URL    = os.getenv("FRONTEND_URL", "http://localhost:5173")