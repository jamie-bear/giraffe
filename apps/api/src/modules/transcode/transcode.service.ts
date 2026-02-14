import { randomUUID } from 'node:crypto';
import { mkdir, rm, readFile, stat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FfmpegWorker, probeStream, decideMode, type TranscodeMode, type ProbeResult } from './ffmpeg.worker.js';
import { NotFoundError, ExternalServiceError } from '../../utils/errors.js';

const TRANSCODE_BASE = join(tmpdir(), 'giraffe-transcode');
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const MAX_SESSIONS_PER_USER = 1;
const MAX_SESSIONS_GLOBAL = 3;

interface TranscodeSession {
  id: string;
  userId: string;
  worker: FfmpegWorker;
  dir: string;
  mode: TranscodeMode;
  probe: ProbeResult;
  createdAt: number;
  lastAccessedAt: number;
  idleTimer: ReturnType<typeof setTimeout>;
}

const sessions = new Map<string, TranscodeSession>();

// Periodic cleanup of orphaned sessions (every 2 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastAccessedAt > IDLE_TIMEOUT_MS) {
      destroySession(id);
    }
  }
}, 2 * 60 * 1000);

function resetIdleTimer(session: TranscodeSession): void {
  clearTimeout(session.idleTimer);
  session.lastAccessedAt = Date.now();
  session.idleTimer = setTimeout(() => {
    destroySession(session.id);
  }, IDLE_TIMEOUT_MS);
}

async function destroySession(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) return;

  clearTimeout(session.idleTimer);
  session.worker.kill();
  sessions.delete(sessionId);

  // Clean up temp directory
  try {
    await rm(session.dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

export interface CreateSessionResult {
  sessionId: string;
  mode: TranscodeMode;
  probe: ProbeResult;
}

/**
 * Create a new transcode session for a resolved stream URL.
 */
export async function createSession(
  userId: string,
  streamUrl: string,
): Promise<CreateSessionResult> {
  // Enforce per-user limit — destroy existing session first
  const userSessions = [...sessions.values()].filter((s) => s.userId === userId);
  if (userSessions.length >= MAX_SESSIONS_PER_USER) {
    for (const old of userSessions) {
      await destroySession(old.id);
    }
  }

  // Enforce global limit
  if (sessions.size >= MAX_SESSIONS_GLOBAL) {
    // Evict oldest session
    let oldest: TranscodeSession | null = null;
    for (const s of sessions.values()) {
      if (!oldest || s.lastAccessedAt < oldest.lastAccessedAt) oldest = s;
    }
    if (oldest) await destroySession(oldest.id);
  }

  // Probe the stream
  let probe: ProbeResult;
  try {
    probe = await probeStream(streamUrl);
  } catch (err) {
    throw new ExternalServiceError('FFmpeg', `Failed to probe stream: ${(err as Error).message}`);
  }

  const mode = decideMode(probe);

  // Passthrough doesn't need FFmpeg at all — return immediately
  if (mode === 'passthrough') {
    return {
      sessionId: '__passthrough__',
      mode,
      probe,
    };
  }

  const sessionId = randomUUID();
  const dir = join(TRANSCODE_BASE, sessionId);
  await mkdir(dir, { recursive: true });

  const worker = new FfmpegWorker({
    inputUrl: streamUrl,
    outputDir: dir,
    mode,
  });

  const session: TranscodeSession = {
    id: sessionId,
    userId,
    worker,
    dir,
    mode,
    probe,
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
    idleTimer: setTimeout(() => destroySession(sessionId), IDLE_TIMEOUT_MS),
  };

  worker.on('error', (err) => {
    console.error(`[Transcode] Session ${sessionId} error:`, err.message);
  });

  worker.on('exit', (code) => {
    if (code !== 0) {
      console.warn(`[Transcode] Session ${sessionId} FFmpeg exited with code ${code}`);
    }
  });

  sessions.set(sessionId, session);
  worker.start();

  // Wait for the first segment to be written before returning
  await waitForPlaylist(dir, 15_000);

  return { sessionId, mode, probe };
}

/**
 * Wait for the HLS playlist file to exist and contain at least one segment.
 */
async function waitForPlaylist(dir: string, timeoutMs: number): Promise<void> {
  const playlistPath = join(dir, 'playlist.m3u8');
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const content = await readFile(playlistPath, 'utf-8');
      // Wait until at least one .ts segment is referenced
      if (content.includes('.ts')) return;
    } catch {
      // File doesn't exist yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  throw new ExternalServiceError('FFmpeg', 'Timed out waiting for transcode to start');
}

/**
 * Get the HLS playlist content for a session.
 */
export async function getPlaylist(sessionId: string): Promise<string> {
  const session = sessions.get(sessionId);
  if (!session) throw new NotFoundError('Transcode session not found or expired');

  resetIdleTimer(session);

  const playlistPath = join(session.dir, 'playlist.m3u8');
  try {
    return await readFile(playlistPath, 'utf-8');
  } catch {
    throw new NotFoundError('Playlist not ready yet');
  }
}

/**
 * Get an HLS segment file as a Buffer.
 */
export async function getSegment(sessionId: string, segmentName: string): Promise<Buffer> {
  const session = sessions.get(sessionId);
  if (!session) throw new NotFoundError('Transcode session not found or expired');

  resetIdleTimer(session);

  // Validate segment name to prevent path traversal
  if (!/^\d{4}\.ts$/.test(segmentName)) {
    throw new NotFoundError('Invalid segment name');
  }

  const segmentPath = join(session.dir, segmentName);
  try {
    return await readFile(segmentPath);
  } catch {
    throw new NotFoundError('Segment not found');
  }
}

/**
 * Explicitly destroy a session.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await destroySession(sessionId);
}

/**
 * Get basic status info for a session.
 */
export function getSessionInfo(sessionId: string): { mode: TranscodeMode; active: boolean } | null {
  const session = sessions.get(sessionId);
  if (!session) return null;
  return { mode: session.mode, active: !session.worker.exited };
}
