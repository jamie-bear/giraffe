export type StreamQuality = '480p' | '720p' | '1080p' | '2160p';
export type StreamSourceType = 'BluRay' | 'REMUX' | 'WEB-DL' | 'WEBRip' | 'HDTV' | 'HDCAM' | 'CAM' | 'Unknown';
export type StreamCodec = 'AV1' | 'H.265' | 'H.264' | 'Unknown';

export interface StreamSource {
  id: string;
  filename: string;
  quality: StreamQuality;
  sourceType: StreamSourceType;
  codec: StreamCodec;
  fileSize: number;
  languages: string[];
  subtitles: string[];
  cached: boolean;
  score: number;
}

export interface ResolvedStream {
  streamUrl: string;
  expiresAt: string;
}
