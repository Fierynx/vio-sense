import { useVideoProcess } from '@/hooks/useVideoProcess'
import { MAX_FRAME_HEIGHT, MAX_FRAME_WIDTH } from '@/config/config'

const VideoStream = () => {
  const {
    videoRef,
    canvasRef,
    prediction,
    connectionStatus,
    isModelReady,
    latency,
    framesCollected,
    maxFrames
  } = useVideoProcess()

  return (
    <div className="text-center">
      <canvas 
        ref={canvasRef} 
        className="hidden"
        width={MAX_FRAME_WIDTH}
        height={MAX_FRAME_HEIGHT}
      />

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full max-w-[320px] rounded-lg border-2 ${
          connectionStatus === 'connected' ? 'border-green-500' : 'border-red-500'
        }`}
      />

      <div className="mt-3">
        {connectionStatus !== 'connected' && (
          <div className="text-red-500 mb-2 font-bold">
            {connectionStatus === 'connecting' ? 'Connecting...' : 'Connection lost. Reconnecting...'}
          </div>
        )}

        {connectionStatus === 'connected' && !isModelReady && (
          <div className="p-2 bg-blue-100 rounded mb-2">
            <div className="font-bold text-blue-800 mb-1">
              Collecting frames: {framesCollected}/{maxFrames}
            </div>
            <div className="h-1 bg-gray-300 rounded overflow-hidden">
              <div
                className="bg-blue-500 h-full transition-all duration-300 ease-in-out"
                style={{ width: `${(framesCollected / maxFrames) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div
          className={`p-2 rounded mb-2 ${
            prediction.isViolent ? 'bg-red-100' : 'bg-green-100'
          } ${isModelReady ? 'opacity-100' : 'opacity-60'}`}
        >
          <strong>Status:</strong>{' '}
          {prediction.isViolent ? (
            <span className="text-red-700 font-bold">Violence Detected</span>
          ) : (
            <span className="text-green-700 font-bold">No Violence</span>
          )}
          <br />
          <strong>Confidence:</strong>{' '}
          <span className="font-bold">{(prediction.confidence * 100).toFixed(1)}%</span>
        </div>

        {connectionStatus === 'connected' && (
          <div className="text-sm text-gray-600">
            <span>Latency: {latency.toFixed(0)} ms</span>
            {isModelReady && (
              <span> • Inference: {prediction.inference_time_ms?.toFixed(0) || 0} ms</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default VideoStream
