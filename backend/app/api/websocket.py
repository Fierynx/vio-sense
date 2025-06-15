from fastapi import WebSocket, WebSocketDisconnect
from app.services.inference import handle_frame
from ..config import SEQUENCE_LENGTH
from ..core.logger import logger

async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket connection accepted")

    try:
        while True:
            data = await websocket.receive_bytes()
            prediction, valid = handle_frame(data)

            await websocket.send_json(prediction)

            if not valid:
                logger.warning("Invalid frame received")
                continue

            frames_info = f"Frames: {prediction['frames_collected']}/{prediction['max_frames']}"
            if prediction.get("ready"):
                logger.info(f"Inference time: {prediction['inference_time_ms']:.2f}ms, {frames_info}")
            else:
                logger.info(f"Collecting frames: {frames_info}")

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.exception(f"WebSocket error: {e}")
