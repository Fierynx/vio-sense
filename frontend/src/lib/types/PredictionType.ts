export type Prediction = {
  isViolent: boolean;
  confidence: number;
  inference_time_ms?: number;
  frames_collected?: number;
  max_frames?: number;
  ready?: boolean;
  error?: string;
};