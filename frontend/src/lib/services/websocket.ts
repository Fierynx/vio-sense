export type Prediction = {
  isViolent: boolean;
  confidence: number;
};

export function createWebSocket(
  onPrediction: (pred: Prediction) => void,
  url = 'ws://localhost:8000/ws'
): WebSocket {
  const ws = new WebSocket(url);
  ws.binaryType = 'arraybuffer';
  ws.onopen = () => console.log('WS connected');
  ws.onmessage = evt => {
    try {
      const data = JSON.parse(evt.data) as Prediction;
      onPrediction(data);
    } catch {
      console.error('Invalid JSON', evt.data);
    }
  };
  ws.onclose = () => console.log('WS disconnected');
  ws.onerror = err => console.error('WS error', err);
  return ws;
}