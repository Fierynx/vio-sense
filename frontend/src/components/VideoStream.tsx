import React, { useEffect, useRef, useState } from 'react'
import { captureFrame } from '@/lib/utils/canvas'
import { createWebSocket, Prediction } from '@/lib/services/websocket'

const FPS = 5 // Frames per second
const INTERVAL = 1000 / FPS

const VideoStream: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const wsRef    = useRef<WebSocket | null>(null)
  const [prediction, setPrediction] = useState<Prediction>({
    isViolent: false,
    confidence: 0,
  })

  useEffect(() => {
    let intervalId: number

    // 1) Request camera access
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then(stream => {
        if (!videoRef.current) return
        // Assign the stream and let autoPlay do its thing
        videoRef.current.srcObject = stream

        // 2) Once we actually start playing frames, open WS & start capturing
        const onPlaying = () => {
          // Open WebSocket
          wsRef.current = createWebSocket(setPrediction)

          wsRef.current.onopen = () => {
            // 3) Start sending frames at fixed FPS
            intervalId = window.setInterval(async () => {
              try {
                const blob = await captureFrame(videoRef.current!)
                const buf  = await blob.arrayBuffer()
                console.log('Sending frame:', buf)
                wsRef.current?.send(buf)
              } catch (err) {
                // If we ever get a null-blob or other error, just skip this frame
                console.warn('captureFrame error, skipping frame:', err)
              }
            }, INTERVAL)
          }
        }

        videoRef.current.addEventListener('playing', onPlaying, { once: true })
      })
      .catch(err => {
        console.error('Camera access error:', err)
      })

    // Cleanup on unmount
    return () => {
      clearInterval(intervalId)
      wsRef.current?.close()
    }
  }, [])

  console.log('Prediction:', prediction)

  return (
    <div style={{ textAlign: 'center' }}>
      <video
        ref={videoRef}
        autoPlay
        muted
        style={{ width: 480, borderRadius: 8, backgroundColor: '#000' }}
      />
      <div style={{ marginTop: 12 }}>
        <strong>Status:</strong>{' '}
        {prediction.isViolent ? (
          <span style={{ color: 'red' }}>Violent</span>
        ) : (
          <span style={{ color: 'green' }}>Safe</span>
        )}
        <br />
        <strong>Confidence:</strong>{' '}
        {(prediction.confidence * 100).toFixed(1)}%
      </div>
    </div>
  )
}

export default VideoStream
