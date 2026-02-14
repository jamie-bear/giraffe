import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

export type TranscodeMode = 'passthrough' | 'remux' | 'transcode';

export interface ProbeResult {
  videoCodec: string;
  audioCodec: string;
  container: string;
  duration: number | null;
}

/**
 * Probe a remote URL with ffprobe to detect codec/container info.
 */
export function probeStream(url: string): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-show_format',
      url,
    ];

    execFile('ffprobe', args, { timeout: 30_000 }, (err, stdout) => {
      if (err) {
        return reject(new Error(`ffprobe failed: ${err.message}`));
      }

      try {
        const data = JSON.parse(stdout) as {
          streams?: Array<{ codec_type?: string; codec_name?: string }>;
          format?: { format_name?: string; duration?: string };
        };

        const videoStream = data.streams?.find((s) => s.codec_type === 'video');
        const audioStream = data.streams?.find((s) => s.codec_type === 'audio');

        resolve({
          videoCodec: videoStream?.codec_name ?? 'unknown',
          audioCodec: audioStream?.codec_name ?? 'unknown',
          container: data.format?.format_name ?? 'unknown',
          duration: data.format?.duration ? parseFloat(data.format.duration) : null,
        });
      } catch {
        reject(new Error('Failed to parse ffprobe output'));
      }
    });
  });
}

/**
 * Decide whether to passthrough, remux, or transcode based on probe results.
 */
export function decideMode(probe: ProbeResult): TranscodeMode {
  const vc = probe.videoCodec.toLowerCase();

  // H.264 in a browser-friendly container → passthrough
  if ((vc === 'h264' || vc === 'x264') && /mp4|mov/.test(probe.container)) {
    return 'passthrough';
  }

  // H.264 in a non-browser container (MKV, AVI, etc.) → remux (copy codec, repackage to HLS)
  if (vc === 'h264' || vc === 'x264') {
    return 'remux';
  }

  // Everything else (H.265, AV1, VP9, etc.) → full transcode
  return 'transcode';
}

export interface FfmpegWorkerOptions {
  inputUrl: string;
  outputDir: string;
  mode: TranscodeMode;
}

/**
 * Manages an FFmpeg child process that produces HLS segments.
 */
export class FfmpegWorker extends EventEmitter {
  private process: ChildProcess | null = null;
  private _exited = false;

  get exited(): boolean {
    return this._exited;
  }

  constructor(private options: FfmpegWorkerOptions) {
    super();
  }

  start(): void {
    const { inputUrl, outputDir, mode } = this.options;
    const playlistPath = `${outputDir}/playlist.m3u8`;
    const segmentPattern = `${outputDir}/%04d.ts`;

    const args: string[] = [
      '-hide_banner',
      '-loglevel', 'warning',
      '-i', inputUrl,
    ];

    if (mode === 'remux') {
      // Copy video codec, only re-encode audio to AAC for compatibility
      args.push(
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
      );
    } else {
      // Full transcode to H.264 + AAC
      args.push(
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '22',
        '-maxrate', '8M',
        '-bufsize', '16M',
        '-c:a', 'aac',
        '-b:a', '192k',
      );
    }

    // HLS output
    args.push(
      '-f', 'hls',
      '-hls_time', '4',
      '-hls_list_size', '0',
      '-hls_flags', 'independent_segments',
      '-hls_segment_filename', segmentPattern,
      playlistPath,
    );

    this.process = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });

    this.process.stderr?.on('data', (chunk: Buffer) => {
      const msg = chunk.toString().trim();
      if (msg) this.emit('log', msg);
    });

    this.process.on('exit', (code) => {
      this._exited = true;
      this.emit('exit', code);
    });

    this.process.on('error', (err) => {
      this._exited = true;
      this.emit('error', err);
    });
  }

  kill(): void {
    if (this.process && !this._exited) {
      this.process.kill('SIGTERM');
      // Force kill after 5s if still alive
      setTimeout(() => {
        if (!this._exited) {
          this.process?.kill('SIGKILL');
        }
      }, 5000);
    }
  }
}
