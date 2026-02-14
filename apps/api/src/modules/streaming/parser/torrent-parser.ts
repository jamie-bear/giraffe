import ptt from 'parse-torrent-title';
import type { StreamQuality, StreamSourceType, StreamCodec } from '@giraffe/shared';

export interface ParsedTorrent {
  title: string;
  quality: StreamQuality;
  sourceType: StreamSourceType;
  codec: StreamCodec;
  languages: string[];
  hasSubtitles: boolean;
}

function mapResolution(resolution: string | undefined): StreamQuality {
  if (!resolution) return '720p';
  const lower = resolution.toLowerCase();
  if (lower.includes('2160') || lower.includes('4k')) return '2160p';
  if (lower.includes('1080')) return '1080p';
  if (lower.includes('720')) return '720p';
  return '480p';
}

function mapSource(source: string | undefined): StreamSourceType {
  if (!source) return 'Unknown';
  const lower = source.toLowerCase();
  if (lower.includes('bluray') || lower.includes('blu-ray')) return 'BluRay';
  if (lower.includes('remux')) return 'REMUX';
  if (lower.includes('web-dl') || lower.includes('webdl')) return 'WEB-DL';
  if (lower.includes('webrip')) return 'WEBRip';
  if (lower.includes('hdtv')) return 'HDTV';
  if (lower.includes('hdcam')) return 'HDCAM';
  if (lower.includes('cam') || lower.includes('ts') || lower.includes('telesync')) return 'CAM';
  return 'Unknown';
}

function mapCodec(codec: string | undefined): StreamCodec {
  if (!codec) return 'Unknown';
  const lower = codec.toLowerCase();
  if (lower.includes('av1') || lower.includes('av01')) return 'AV1';
  if (lower.includes('265') || lower.includes('hevc')) return 'H.265';
  if (lower.includes('264') || lower.includes('avc')) return 'H.264';
  return 'Unknown';
}

export function parseTorrentFilename(filename: string): ParsedTorrent {
  const parsed = ptt.parse(filename);

  return {
    title: parsed.title || filename,
    quality: mapResolution(parsed.resolution),
    sourceType: mapSource(parsed.source),
    codec: mapCodec(parsed.codec),
    languages: parsed.languages ?? [],
    hasSubtitles: filename.toLowerCase().includes('sub') || filename.toLowerCase().includes('srt'),
  };
}
