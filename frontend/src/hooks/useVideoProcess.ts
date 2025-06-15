import { useEffect, useRef, useState } from 'react'
import { createWebSocket, registerConnectionListener, isWebSocketConnected } from '@/lib/services/websocket'
import { Prediction } from '@/lib/types/PredictionType'
import { MAX_FRAME_HEIGHT, MAX_FRAME_WIDTH, FRAME_INTERVAL_MS } from '@/config/config'
import { captureFrame } from '@/lib/utils/frameCapture'

export const useVideoProcess = () => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const processingRef = useRef(false)
  const mountedRef = useRef(true)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastFrameSentTimeRef = useRef<number>(0)

  const [prediction, setPrediction] = useState<Prediction>({ isViolent: false, confidence: 0 })
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [latency, setLatency] = useState<number>(0)
  const [framesCollected, setFramesCollected] = useState<number>(0)
  const [maxFrames, setMaxFrames] = useState<number>(16)
  const [isModelReady, setIsModelReady] = useState<boolean>(false)

  const sendFrame = async () => {
    if (!videoRef.current || processingRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return
    }

    try {
      processingRef.current = true
      lastFrameSentTimeRef.current = performance.now()

      const blob = await captureFrame(videoRef.current, canvasRef.current)
      if (blob) {
        const buffer = await blob.arrayBuffer()
        wsRef.current.send(buffer)
      } else {
        processingRef.current = false
      }
    } catch (err) {
      console.error("Error sending frame:", err)
      processingRef.current = false
    }
  }

  const startFrameInterval = () => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current)
    }

    frameIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN && !processingRef.current) {
        sendFrame()
      }
    }, FRAME_INTERVAL_MS)
  }

  const handleConnectionStatus = (status: 'open' | 'closed' | 'connecting' | 'error') => {
    if (!mountedRef.current) return

    switch (status) {
      case 'open':
        setConnectionStatus('connected')
        startFrameInterval()
        break
      case 'closed':
      case 'error':
        setConnectionStatus('disconnected')
        processingRef.current = false
        if (frameIntervalRef.current) clearInterval(frameIntervalRef.current)

        reconnectTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            initWebSocket()
          }
        }, 2000)
        break
      case 'connecting':
        setConnectionStatus('connecting')
        break
    }
  }

  const initWebSocket = () => {
    if (!mountedRef.current) return
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)

    try {
      const handlePrediction = (pred: Prediction) => {
        const now = performance.now()
        const frameSendTime = lastFrameSentTimeRef.current
        if (frameSendTime > 0) {
          const currentLatency = now - frameSendTime
          setLatency(currentLatency)
        }

        setIsModelReady(pred.ready || false)
        if (typeof pred.frames_collected === 'number') setFramesCollected(pred.frames_collected)
        if (typeof pred.max_frames === 'number') setMaxFrames(pred.max_frames)
        setPrediction(pred)

        processingRef.current = false
      }

      const ws = createWebSocket(handlePrediction)
      wsRef.current = ws
    } catch (err) {
      console.error('Failed to initialize WebSocket:', err)
      handleConnectionStatus('error')
    }
  }

  useEffect(() => {
    mountedRef.current = true
    const unregisterListener = registerConnectionListener(handleConnectionStatus)

    if (isWebSocketConnected()) {
      setConnectionStatus('connected')
      startFrameInterval()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          setConnectionStatus('connected')
        } else if (connectionStatus === 'connected') {
          initWebSocket()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: MAX_FRAME_WIDTH },
        height: { ideal: MAX_FRAME_HEIGHT },
        frameRate: { ideal: 15 }
      }
    })
      .then(stream => {
        if (!videoRef.current || !mountedRef.current) return
        videoRef.current.srcObject = stream
        videoRef.current.addEventListener('playing', () => {
          if (mountedRef.current) {
            initWebSocket()
          }
        }, { once: true })
      })
      .catch(err => {
        console.error('Camera access error:', err)
      })

    return () => {
      mountedRef.current = false
      unregisterListener()
      document.removeEventListener('visibilitychange', handleVisibilityChange)

      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current)
      wsRef.current = null

      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  return {
    videoRef,
    canvasRef,
    prediction,
    connectionStatus,
    isModelReady,
    latency,
    framesCollected,
    maxFrames,
  }
}
