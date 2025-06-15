import { MAX_FRAME_WIDTH, MAX_FRAME_HEIGHT } from '@/config/config';

export const captureFrame = async (
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement | null
): Promise<Blob | null> => {
    if (!canvas) return null;
    
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return null;
    
    // Set canvas dimensions to match desired output size
    canvas.width = MAX_FRAME_WIDTH;
    canvas.height = MAX_FRAME_HEIGHT;
    
    // Draw the current video frame to canvas with proper sizing
    try {
      // Clear canvas first
      ctx.fillStyle = 'rgb(0, 0, 0)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to create blob from canvas'));
          },
          'image/jpeg', 
          0.8  // Good quality/size balance
        );
      });
    } catch (err) {
      console.error('Error capturing frame:', err);
      return null;
    }
  };
