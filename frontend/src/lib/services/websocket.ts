import { Prediction } from '../types/PredictionType';

// Global WebSocket instance to prevent creating multiple connections
let globalWsInstance: WebSocket | null = null;
let connectionCallbacks: ((status: 'open' | 'closed' | 'connecting' | 'error') => void)[] = [];

// Register a connection status listener
export function registerConnectionListener(callback: (status: 'open' | 'closed' | 'connecting' | 'error') => void) {
  connectionCallbacks.push(callback);
  
  // Immediately call with current status if websocket exists
  if (globalWsInstance) {
    const status = getConnectionStatus(globalWsInstance);
    callback(status);
  }
  
  // Return unregister function
  return () => {
    connectionCallbacks = connectionCallbacks.filter(cb => cb !== callback);
  };
}

// Get connection status from WebSocket
function getConnectionStatus(ws: WebSocket): 'open' | 'closed' | 'connecting' | 'error' {
  switch (ws.readyState) {
    case WebSocket.CONNECTING:
      return 'connecting';
    case WebSocket.OPEN:
      return 'open';
    case WebSocket.CLOSING:
    case WebSocket.CLOSED:
      return 'closed';
    default:
      return 'error';
  }
}

// Notify all connection listeners
function notifyConnectionStatus(status: 'open' | 'closed' | 'connecting' | 'error') {
  connectionCallbacks.forEach(callback => {
    try {
      callback(status);
    } catch (e) {
      console.error('Error in connection listener:', e);
    }
  });
}

export function createWebSocket(
  onPrediction: (pred: Prediction) => void,
  url = 'ws://localhost:8000/ws'
): WebSocket {
  // Use existing WebSocket if it's open
  if (globalWsInstance && globalWsInstance.readyState === WebSocket.OPEN) {
    console.log('Reusing existing WebSocket connection');
    // Notify that it's open
    notifyConnectionStatus('open');
    return globalWsInstance;
  }
  
  // Close existing connection if it exists
  if (globalWsInstance) {
    try {
      console.log('Closing existing WebSocket connection');
      globalWsInstance.close();
    } catch (e) {
      console.error('Error closing existing connection:', e);
    }
    globalWsInstance = null;
  }
  
  // Notify that we're connecting
  notifyConnectionStatus('connecting');

  console.log('Creating new WebSocket connection to', url);
  const ws = new WebSocket(url);
  globalWsInstance = ws;
  
  ws.binaryType = 'arraybuffer';
  
  ws.onopen = () => {
    console.log('WebSocket connected');
    notifyConnectionStatus('open');
  };
  
  ws.onmessage = evt => {
    try {
      const data = JSON.parse(evt.data) as Prediction;
      onPrediction(data);
    } catch (err) {
      console.error('Invalid JSON:', err, evt.data);
    }
  };
  
  ws.onclose = (evt) => {
    console.log('WebSocket disconnected, code:', evt.code, 'reason:', evt.reason);
    notifyConnectionStatus('closed');
    
    // Clear global reference when closed
    if (globalWsInstance === ws) {
      globalWsInstance = null;
    }
  };
  
  ws.onerror = err => {
    console.error('WebSocket error:', err);
    notifyConnectionStatus('error');
  };
  
  return ws;
}

// Check if WebSocket is already connected
export function isWebSocketConnected(): boolean {
  return globalWsInstance !== null && globalWsInstance.readyState === WebSocket.OPEN;
}