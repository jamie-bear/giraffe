# Action Plan: Server-Side Transcoding for Universal Playback

## Problem

Videos sourced via Real-Debrid often use codecs (H.265/HEVC, some AV1 profiles) or containers (MKV) that browsers cannot decode natively. The current workaround — preferring H.264 in scoring and auto-falling-back on error — is lossy: it skips higher-quality sources and still fails when *no* H.264 source exists.

We need a transcoding layer that can take any input format and produce a browser-compatible stream on the fly.

---

## Architecture Overview

```
Browser  ←──  HLS (.m3u8 + .ts segments)  ←──  Transcode Proxy  ←──  Real-Debrid URL
                                                  (FFmpeg)
```

Instead of handing the raw Real-Debrid URL to `<video src>`, the API will proxy the stream through an FFmpeg-based transcoding service that remuxes or transcodes into HLS (H.264 + AAC). The browser plays an `.m3u8` playlist — universally supported by every modern browser and mobile device via `hls.js` or native HLS.

---

## Phase 1: Transcoding Proxy Service

### 1.1 — New module: `apps/api/src/modules/transcode/`

Create a lightweight transcoding proxy as a Fastify module within the existing API.

```
apps/api/src/modules/transcode/
├── transcode.routes.ts      # Fastify route registration
├── transcode.service.ts     # Session management, FFmpeg orchestration
├── ffmpeg.worker.ts         # FFmpeg process spawning & lifecycle
├── segment-store.ts         # In-memory or disk segment buffer
└── transcode.schemas.ts     # Zod schemas for route params
```

### 1.2 — FFmpeg strategy: remux-first, transcode-fallback

Not every stream needs full transcoding (which is CPU-expensive). Use a tiered approach:

| Input codec | Input container | Action | Output | CPU cost |
|---|---|---|---|---|
| H.264 | MKV | **Remux** only | HLS (copy codec) | Near zero |
| H.264 | MP4 | **Passthrough** — no transcode needed | Direct URL | None |
| H.265 / HEVC | Any | **Transcode** to H.264 | HLS (libx264) | High |
| AV1 | Any | **Transcode** to H.264 | HLS (libx264) | High |
| Unknown | Any | **Transcode** to H.264 | HLS (libx264) | High |

The proxy probes the input with `ffprobe` to decide the strategy before starting the FFmpeg pipeline.

### 1.3 — FFmpeg command templates

**Remux (codec copy):**
```bash
ffmpeg -i <input_url> \
  -c:v copy -c:a aac -b:a 192k \
  -f hls -hls_time 4 -hls_list_size 0 \
  -hls_segment_filename '/tmp/giraffe/<session>/%04d.ts' \
  '/tmp/giraffe/<session>/playlist.m3u8'
```

**Transcode (H.265 → H.264):**
```bash
ffmpeg -i <input_url> \
  -c:v libx264 -preset veryfast -crf 22 -maxrate 8M -bufsize 16M \
  -c:a aac -b:a 192k \
  -f hls -hls_time 4 -hls_list_size 0 \
  -hls_segment_filename '/tmp/giraffe/<session>/%04d.ts' \
  '/tmp/giraffe/<session>/playlist.m3u8'
```

### 1.4 — Session lifecycle

Each transcode session:

1. **Created** when the client requests a stream → returns a `sessionId`
2. **FFmpeg spawns** and begins writing HLS segments to a temp directory
3. **Client polls** the `.m3u8` endpoint; segments are served as they become available
4. **Idle timeout** (5 min no requests) → kill FFmpeg, cleanup temp files
5. **Max duration** safety limit (6 hours, matching Real-Debrid URL expiry)

---

## Phase 2: API Routes

### 2.1 — New endpoints

```
POST   /api/v1/stream/transcode
       Body: { sourceId, tmdbId, contentType }
       Returns: { sessionId, playlistUrl, mode: "remux" | "transcode" | "passthrough" }

GET    /api/v1/stream/transcode/:sessionId/playlist.m3u8
       Returns: HLS master playlist (auto-updates as segments are written)

GET    /api/v1/stream/transcode/:sessionId/:segment.ts
       Returns: Individual transport stream segment

DELETE /api/v1/stream/transcode/:sessionId
       Kills FFmpeg process and cleans up temp files
```

### 2.2 — Integration with existing resolve flow

Modify `POST /stream/resolve` to return additional metadata:

```typescript
interface ResolvedStream {
  streamUrl: string;          // Raw Real-Debrid URL (existing)
  expiresAt: string;
  // New fields:
  codec: string;              // Detected codec from source metadata
  container: string;          // Detected container
  needsTranscode: boolean;    // true if codec is not browser-native
  transcodeUrl?: string;      // Pre-created transcode session URL if needed
}
```

Alternatively, keep `/stream/resolve` unchanged and let the frontend decide whether to hit `/stream/transcode` based on the source's codec metadata (already available in `StreamSource.codec`).

---

## Phase 3: Frontend HLS Player

### 3.1 — Replace native `<video>` with HLS-capable player

Install `hls.js` (lightweight, battle-tested HLS library):

```
npm install hls.js --workspace=apps/web
```

### 3.2 — Player logic in watch page

```typescript
// Pseudo-logic for the watch page:

if (source.codec === 'H.264' && container === 'mp4') {
  // Direct playback — no transcode needed
  video.src = resolvedStream.streamUrl;
} else {
  // Request transcode session
  const { playlistUrl } = await apiClient('/stream/transcode', {
    method: 'POST',
    body: { sourceId, tmdbId, contentType }
  });

  if (Hls.isSupported()) {
    const hls = new Hls();
    hls.loadSource(playlistUrl);
    hls.attachMedia(videoElement);
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari native HLS
    video.src = playlistUrl;
  }
}
```

### 3.3 — UI updates

- Show a brief "Preparing stream..." state while FFmpeg generates the first few segments
- Display current mode (Direct / Remux / Transcode) as a subtle badge
- Keep existing auto-fallback: if transcode session fails, try next source
- Add quality selector later (Phase 5) if multi-bitrate profiles are generated

---

## Phase 4: Infrastructure & Dependencies

### 4.1 — FFmpeg binary

FFmpeg must be available on the server. Options:

| Approach | Pros | Cons |
|---|---|---|
| System package (`apt install ffmpeg`) | Simple, full-featured | Requires server access |
| Static binary (BtbN builds) | No system deps, pinned version | ~80 MB binary |
| Docker sidecar | Isolated, scalable | More complex deployment |

**Recommendation:** Use a static FFmpeg binary bundled in the Docker image. Add to the API's `Dockerfile`:

```dockerfile
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
```

### 4.2 — Temp storage

HLS segments are written to disk temporarily. Requirements:
- ~50 MB per hour of remuxed content
- ~200 MB per hour of transcoded content (at veryfast preset)
- Cleanup on session end + periodic garbage collection for orphaned sessions

Use `/tmp/giraffe/transcode/<sessionId>/` with a cron-like cleanup interval.

### 4.3 — Resource limits

Transcoding is CPU-intensive. Guard against abuse:

- **Max concurrent sessions per user:** 1 (configurable)
- **Max concurrent sessions globally:** 3 (configurable based on server CPU)
- **FFmpeg process priority:** `nice -n 10` to avoid starving the API
- **Memory limit:** Set `ulimit` or cgroup constraints on FFmpeg child processes
- **CPU preset:** `veryfast` balances quality vs CPU cost. Avoid `slow`/`medium` for live transcoding.

---

## Phase 5: Future Enhancements (Out of Initial Scope)

### 5.1 — Adaptive bitrate (ABR)

Generate multiple HLS variant streams (e.g. 1080p, 720p, 480p) so the player can adapt to network conditions. This requires running multiple FFmpeg outputs simultaneously — more CPU but better UX on variable connections.

### 5.2 — Hardware-accelerated transcoding

If the server has a GPU (NVIDIA), use `h264_nvenc` instead of `libx264`:

```bash
ffmpeg -hwaccel cuda -i <input> -c:v h264_nvenc -preset p4 ...
```

Also supports Intel QSV (`h264_qsv`) and AMD AMF (`h264_amf`). Auto-detect available hardware at startup.

### 5.3 — Subtitle burn-in

For devices that don't support subtitle tracks, burn subtitles into the video stream during transcode:

```bash
ffmpeg -i <input> -vf "subtitles=<sub_file>" ...
```

### 5.4 — Seek optimization

HLS supports seeking natively, but for very large files the initial `ffprobe` + segment map generation can be slow. Consider:
- Pre-generating a segment keyframe index
- Using `ffmpeg -ss <time>` for server-side seek before transcoding

### 5.5 — Transcode caching

Cache transcoded segments keyed by `(infoHash, fileIdx, profile)`. If the same content is played again (by the same or different user), serve cached segments instead of re-transcoding.

---

## Implementation Order

| Step | Task | Effort |
|---|---|---|
| 1 | Add FFmpeg to Docker image / verify availability | Small |
| 2 | Build `transcode.service.ts` — session manager, FFmpeg spawning, temp dir lifecycle | Large |
| 3 | Build `ffmpeg.worker.ts` — process management, ffprobe detection, command construction | Large |
| 4 | Build `segment-store.ts` — segment serving, playlist generation | Medium |
| 5 | Build `transcode.routes.ts` — HLS playlist & segment endpoints | Medium |
| 6 | Install `hls.js`, update watch page player with transcode integration | Medium |
| 7 | Update `/stream/resolve` response or add codec/container info to source metadata | Small |
| 8 | Add resource limits (max sessions, cleanup, timeouts) | Small |
| 9 | Test with H.265 MKV, H.264 MKV (remux), H.264 MP4 (passthrough), AV1 | Medium |
| 10 | Update codec scoring — stop penalizing H.265/AV1 since transcode handles them | Small |

---

## Key Design Decisions

1. **Transcode at the API, not a separate service** — Giraffe is a personal media center (1-2 users), not a multi-tenant platform. A separate microservice adds deployment complexity with no real benefit at this scale.

2. **HLS over DASH** — HLS has broader native support (Safari plays it natively, `hls.js` covers the rest). DASH requires `dash.js` with no native browser support.

3. **Remux-first** — Many "incompatible" streams are actually H.264 in MKV containers. Remuxing to HLS/TS is near-instant and avoids expensive transcoding entirely.

4. **On-demand, not pre-transcoded** — Pre-transcoding every potential source wastes storage and compute. Transcode only when the user actually plays content.

5. **Fallback preserved** — If transcoding fails (FFmpeg error, resource limit hit), the system falls back to the existing behavior: try direct playback, then try next source. The transcode layer is additive, not a replacement.
