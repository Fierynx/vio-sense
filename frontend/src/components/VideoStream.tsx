import React, { useEffect, useRef, useState } from 'react'
import { createWebSocket, registerConnectionListener, isWebSocketConnected } from '@/lib/services/websocket'
import { Prediction } from '@/lib/types/PredictionType'
import { MAX_FRAME_HEIGHT, MAX_FRAME_WIDTH, FRAME_INTERVAL_MS } from '@/config/config';
import { captureFrame } from '@/lib/utils/frameCapture'

const VideoStream: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const processingRef = useRef<boolean>(false)
  const mountedRef = useRef<boolean>(true)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const frameIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  const [prediction, setPrediction] = useState<Prediction>({
    isViolent: false,
    confidence: 0,
  })
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [latency, setLatency] = useState<number>(0)
  const [framesCollected, setFramesCollected] = useState<number>(0)
  const [maxFrames, setMaxFrames] = useState<number>(16)
  const [isModelReady, setIsModelReady] = useState<boolean>(false)
  const lastFrameSentTimeRef = useRef<number>(0)

  // Process and send a frame
  const sendFrame = async () => {
    if (!videoRef.current || processingRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      processingRef.current = true;
      lastFrameSentTimeRef.current = performance.now();
      
      const blob = await captureFrame(videoRef.current, canvasRef.current);
      if (blob && wsRef.current?.readyState === WebSocket.OPEN) {
        const buffer = await blob.arrayBuffer();
        wsRef.current.send(buffer);
      } else {
        // If we couldn't get a frame or WebSocket is closed, release the lock
        processingRef.current = false;
      }
    } catch (err) {
      console.error("Error sending frame:", err);
      processingRef.current = false;
    }
  }

  // Start periodic frame sending
  const startFrameInterval = () => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    
    frameIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN && !processingRef.current) {
        sendFrame();
      }
    }, FRAME_INTERVAL_MS);
    
    console.log(`Started frame interval at ${1000/FRAME_INTERVAL_MS}fps`);
  };

  // Handle connection status changes
  const handleConnectionStatus = (status: 'open' | 'closed' | 'connecting' | 'error') => {
    if (!mountedRef.current) return;
    
    switch (status) {
      case 'open':
        setConnectionStatus('connected');
        startFrameInterval();
        break;
      case 'closed':
      case 'error':
        setConnectionStatus('disconnected');
        processingRef.current = false;
        
        // Stop frame sending
        if (frameIntervalRef.current) {
          clearInterval(frameIntervalRef.current);
          frameIntervalRef.current = null;
        }
        
        // Try to reconnect after a delay
        reconnectTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            console.log("Attempting to reconnect...");
            initWebSocket();
          }
        }, 2000);
        break;
      case 'connecting':
        setConnectionStatus('connecting');
        break;
    }
  };

  // Initialize WebSocket with reconnection logic
  const initWebSocket = () => {
    if (!mountedRef.current) return;
    
    // Clear any existing reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // We'll let the connection listener handle the UI status
    
    try {
      // Custom prediction handler that tracks latency
      const handlePrediction = (pred: Prediction) => {
        const now = performance.now();
        const frameSendTime = lastFrameSentTimeRef.current;
        
        // Calculate and track latency
        if (frameSendTime > 0) {
          const currentLatency = now - frameSendTime;
          setLatency(currentLatency);
        }
        
        // Update model readiness
        setIsModelReady(pred.ready || false);
        
        // Update frame collection status
        if (typeof pred.frames_collected === 'number') {
          setFramesCollected(pred.frames_collected);
        }
        if (typeof pred.max_frames === 'number') {
          setMaxFrames(pred.max_frames);
        }
        
        // Update prediction state
        setPrediction(pred);
        
        // Release the processing lock
        processingRef.current = false;
      };
      
      // Create WebSocket
      const ws = createWebSocket(handlePrediction);
      wsRef.current = ws;
    } catch (err) {
      console.error('Failed to initialize WebSocket:', err);
      handleConnectionStatus('error');
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    const localVideoRef = videoRef.current;
    
    // Register connection listener
    const unregisterListener = registerConnectionListener(handleConnectionStatus);
    
    // Check if already connected on mount
    if (isWebSocketConnected()) {
      setConnectionStatus('connected');
      startFrameInterval();
    }
    
    // Handle visibility change to detect connection issues when tab becomes active
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check connection status when page becomes visible again
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          setConnectionStatus('connected');
        } else {
          // If we think we're connected but not, reconnect
          if (connectionStatus === 'connected') {
            console.log("Connection state mismatch, reconnecting...");
            initWebSocket();
          }
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Request camera access
    navigator.mediaDevices
      .getUserMedia({ 
        video: { 
          width: { ideal: MAX_FRAME_WIDTH }, 
          height: { ideal: MAX_FRAME_HEIGHT },
          frameRate: { ideal: 15 }
        } 
      })
      .then(stream => {
        if (!videoRef.current || !mountedRef.current) return;
        videoRef.current.srcObject = stream;

        // Initialize WebSocket once video is playing
        videoRef.current.addEventListener('playing', () => {
          if (mountedRef.current) {
            console.log("Video is playing, initializing WebSocket");
            initWebSocket();
          }
        }, { once: true });
      })
      .catch(err => {
        console.error('Camera access error:', err);
      });

    // Cleanup function
    return () => {
      mountedRef.current = false;
      unregisterListener();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
      
      // We don't close the global WebSocket anymore, just our reference to it
      wsRef.current = null;
      
      if (localVideoRef?.srcObject) {
        const stream = localVideoRef.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div style={{ textAlign: 'center' }}>
      {/* Hidden canvas used for frame capture */}
      <canvas 
        ref={canvasRef} 
        style={{ display: 'none' }}
        width={MAX_FRAME_WIDTH}
        height={MAX_FRAME_HEIGHT}
      />
      
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ 
          width: '100%', 
          maxWidth: '320px', 
          borderRadius: '8px',
          border: `2px solid ${connectionStatus === 'connected' ? '#4CAF50' : '#F44336'}`
        }}
      />
      
      <div style={{ marginTop: '12px' }}>
        {connectionStatus !== 'connected' ? (
          <div style={{ color: '#F44336', marginBottom: '8px', fontWeight: 'bold' }}>
            {connectionStatus === 'connecting' ? 'Connecting...' : 'Connection lost. Reconnecting...'}
          </div>
        ) : null}
        
        {connectionStatus === 'connected' && !isModelReady && (
          <div style={{ 
            padding: '8px',
            backgroundColor: '#E3F2FD',
            borderRadius: '4px',
            marginBottom: '8px'
          }}>
            <div style={{ fontWeight: 'bold', color: '#1565C0', marginBottom: '4px' }}>
              Collecting frames: {framesCollected}/{maxFrames}
            </div>
            <div style={{ 
              height: '4px', 
              backgroundColor: '#e0e0e0', 
              borderRadius: '2px',
              overflow: 'hidden'
            }}>
              <div style={{ 
                width: `${(framesCollected / maxFrames) * 100}%`, 
                backgroundColor: '#2196F3',
                height: '100%',
                transition: 'width 0.3s ease-in-out'
              }} />
            </div>
          </div>
        )}
        
        <div style={{ 
          padding: '8px',
          backgroundColor: prediction.isViolent ? '#FFEBEE' : '#E8F5E9',
          borderRadius: '4px',
          marginBottom: '8px',
          opacity: isModelReady ? 1 : 0.6
        }}>
          <strong>Status:</strong>{' '}
          {prediction.isViolent ? (
            <span style={{ color: '#D32F2F', fontWeight: 'bold' }}>Violence Detected</span>
          ) : (
            <span style={{ color: '#388E3C', fontWeight: 'bold' }}>No Violence</span>
          )}
          <br />
          <strong>Confidence:</strong>{' '}
          <span style={{ fontWeight: 'bold' }}>{(prediction.confidence * 100).toFixed(1)}%</span>
        </div>
        
        {connectionStatus === 'connected' && (
          <div style={{ fontSize: '0.8rem', color: '#666' }}>
            <span>Latency: {latency.toFixed(0)} ms</span>
            {isModelReady && (
              <span> • Inference: {prediction.inference_time_ms?.toFixed(0) || 0} ms</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoStream;