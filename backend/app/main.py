import uvicorn
from collections import deque
import numpy as np

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.model import ViolenceDetector
from app.utils import decode_frame_to_rgb, preprocess_frame

from .config import (
    SEQUENCE_LENGTH,
    IMAGE_WIDTH,
    IMAGE_HEIGHT,
    MODEL_PATH,
)

app = FastAPI()

# CORS so your Vite frontend can connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model once at startup
violence_detector = ViolenceDetector(MODEL_PATH, (IMAGE_WIDTH, IMAGE_HEIGHT))

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    frames_queue: deque = deque(maxlen=SEQUENCE_LENGTH)

    try:
        while True:
            # 1) Receive raw JPEG/PNG bytes
            frame_bytes = await ws.receive_bytes()
            print("Received frame of size: ", len(frame_bytes))

            # 2) Decode to RGB and preprocess to shape (1, H, W, C)
            rgb   = decode_frame_to_rgb(frame_bytes)
            normalized_frame = preprocess_frame(rgb, violence_detector.input_size) 

            # 3) Append just the (H,W,C) slice into our deque
            frames_queue.append(normalized_frame)

            # 4) Once we have SEQ_LEN frames, run the BiLSTM sequence model
            if len(frames_queue) == SEQUENCE_LENGTH:
                seq_np = np.expand_dims(frames_queue, axis=0)
                result = violence_detector.predict_sequence(seq_np)
                await ws.send_json(result)
            else:
                await ws.send_json({"framesBuffered": len(frames_queue)})

    except WebSocketDisconnect:
        print("WebSocket client disconnected")

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
