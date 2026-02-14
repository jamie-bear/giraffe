import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { transcodeBodySchema, sessionParamsSchema, segmentParamsSchema } from './transcode.schemas.js';
import * as transcodeService from './transcode.service.js';
import * as streamingService from '../streaming/streaming.service.js';

export async function transcodeRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // All transcode routes require auth
  typedApp.addHook('preHandler', app.authenticate);

  /**
   * Start a transcode session.
   * Resolves the source, probes the stream, and starts FFmpeg if needed.
   */
  typedApp.post(
    '/',
    { schema: { body: transcodeBodySchema } },
    async (request, reply) => {
      const { sourceId, tmdbId, contentType } = request.body;
      const userId = request.user.sub;

      // First resolve the raw stream URL via the existing streaming service
      const resolved = await streamingService.resolveStream(userId, sourceId);

      // Create a transcode session (probes, decides mode, starts FFmpeg)
      const session = await transcodeService.createSession(userId, resolved.streamUrl);

      // If passthrough, just return the direct URL — no HLS needed
      if (session.mode === 'passthrough') {
        return reply.send({
          mode: 'passthrough' as const,
          streamUrl: resolved.streamUrl,
          sessionId: null,
          playlistUrl: null,
          probe: session.probe,
        });
      }

      return reply.send({
        mode: session.mode,
        streamUrl: null,
        sessionId: session.sessionId,
        playlistUrl: `/api/v1/transcode/${session.sessionId}/playlist.m3u8`,
        probe: session.probe,
      });
    },
  );

  /**
   * Serve the HLS playlist (.m3u8) for a transcode session.
   */
  typedApp.get(
    '/:sessionId/playlist.m3u8',
    { schema: { params: sessionParamsSchema } },
    async (request, reply) => {
      const { sessionId } = request.params;
      const playlist = await transcodeService.getPlaylist(sessionId);

      return reply
        .header('Content-Type', 'application/vnd.apple.mpegurl')
        .header('Cache-Control', 'no-cache')
        .send(playlist);
    },
  );

  /**
   * Serve an individual HLS segment (.ts) for a transcode session.
   */
  typedApp.get(
    '/:sessionId/:segment',
    { schema: { params: segmentParamsSchema } },
    async (request, reply) => {
      const { sessionId, segment } = request.params;
      const data = await transcodeService.getSegment(sessionId, segment);

      return reply
        .header('Content-Type', 'video/mp2t')
        .header('Cache-Control', 'public, max-age=3600')
        .send(data);
    },
  );

  /**
   * Destroy a transcode session and clean up resources.
   */
  typedApp.delete(
    '/:sessionId',
    { schema: { params: sessionParamsSchema } },
    async (request, reply) => {
      const { sessionId } = request.params;
      await transcodeService.deleteSession(sessionId);
      return reply.code(204).send();
    },
  );
}
