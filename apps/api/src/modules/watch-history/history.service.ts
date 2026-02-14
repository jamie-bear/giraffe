import { eq, and, desc, count, isNull } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { watchHistory } from '../../db/schema/watch-history.js';
import { content } from '../../db/schema/content.js';
import { NotFoundError, ForbiddenError } from '../../utils/errors.js';
import type { WatchProgress, HistoryEntry } from '@giraffe/shared';

const COMPLETION_THRESHOLD = 0.9; // 90% watched = completed

export async function updateProgress(
  userId: string,
  data: {
    contentId: string;
    seasonNumber?: number;
    episodeNumber?: number;
    progressSeconds: number;
    durationSeconds: number;
  },
): Promise<WatchProgress> {
  const completed = data.durationSeconds > 0 && data.progressSeconds / data.durationSeconds >= COMPLETION_THRESHOLD;
  const progressPercent = data.durationSeconds > 0
    ? Math.round((data.progressSeconds / data.durationSeconds) * 100)
    : 0;

  // Upsert: find existing entry for this user + content + episode
  const conditions = [
    eq(watchHistory.userId, userId),
    eq(watchHistory.contentId, data.contentId),
  ];

  if (data.seasonNumber != null) {
    conditions.push(eq(watchHistory.seasonNumber, data.seasonNumber));
  } else {
    conditions.push(isNull(watchHistory.seasonNumber));
  }

  if (data.episodeNumber != null) {
    conditions.push(eq(watchHistory.episodeNumber, data.episodeNumber));
  } else {
    conditions.push(isNull(watchHistory.episodeNumber));
  }

  const [existing] = await db
    .select()
    .from(watchHistory)
    .where(and(...conditions))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(watchHistory)
      .set({
        progressSeconds: data.progressSeconds,
        durationSeconds: data.durationSeconds,
        completed,
        lastWatchedAt: new Date(),
      })
      .where(eq(watchHistory.id, existing.id))
      .returning();

    return {
      id: updated.id,
      contentId: updated.contentId,
      seasonNumber: updated.seasonNumber,
      episodeNumber: updated.episodeNumber,
      progressSeconds: updated.progressSeconds,
      durationSeconds: updated.durationSeconds,
      completed: updated.completed,
      progressPercent,
    };
  }

  const [created] = await db
    .insert(watchHistory)
    .values({
      userId,
      contentId: data.contentId,
      seasonNumber: data.seasonNumber ?? null,
      episodeNumber: data.episodeNumber ?? null,
      progressSeconds: data.progressSeconds,
      durationSeconds: data.durationSeconds,
      completed,
    })
    .returning();

  return {
    id: created.id,
    contentId: created.contentId,
    seasonNumber: created.seasonNumber,
    episodeNumber: created.episodeNumber,
    progressSeconds: created.progressSeconds,
    durationSeconds: created.durationSeconds,
    completed: created.completed,
    progressPercent,
  };
}

export async function getHistory(userId: string, page: number, limit: number) {
  const offset = (page - 1) * limit;

  const results = await db
    .select({
      id: watchHistory.id,
      contentId: watchHistory.contentId,
      contentTitle: content.title,
      contentPosterPath: content.posterPath,
      contentType: content.contentType,
      seasonNumber: watchHistory.seasonNumber,
      episodeNumber: watchHistory.episodeNumber,
      progressSeconds: watchHistory.progressSeconds,
      durationSeconds: watchHistory.durationSeconds,
      completed: watchHistory.completed,
      lastWatchedAt: watchHistory.lastWatchedAt,
    })
    .from(watchHistory)
    .innerJoin(content, eq(watchHistory.contentId, content.id))
    .where(eq(watchHistory.userId, userId))
    .orderBy(desc(watchHistory.lastWatchedAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: count(watchHistory.id) })
    .from(watchHistory)
    .where(eq(watchHistory.userId, userId));

  return {
    entries: results.map((r) => ({
      ...r,
      lastWatchedAt: r.lastWatchedAt.toISOString(),
    })) as HistoryEntry[],
    page,
    totalPages: Math.ceil(Number(total) / limit),
    total: Number(total),
  };
}

export async function getContinueWatching(userId: string): Promise<HistoryEntry[]> {
  const results = await db
    .select({
      id: watchHistory.id,
      contentId: watchHistory.contentId,
      contentTitle: content.title,
      contentPosterPath: content.posterPath,
      contentType: content.contentType,
      seasonNumber: watchHistory.seasonNumber,
      episodeNumber: watchHistory.episodeNumber,
      progressSeconds: watchHistory.progressSeconds,
      durationSeconds: watchHistory.durationSeconds,
      completed: watchHistory.completed,
      lastWatchedAt: watchHistory.lastWatchedAt,
    })
    .from(watchHistory)
    .innerJoin(content, eq(watchHistory.contentId, content.id))
    .where(and(eq(watchHistory.userId, userId), eq(watchHistory.completed, false)))
    .orderBy(desc(watchHistory.lastWatchedAt))
    .limit(20);

  return results.map((r) => ({
    ...r,
    lastWatchedAt: r.lastWatchedAt.toISOString(),
  })) as HistoryEntry[];
}

export async function deleteHistoryEntry(userId: string, entryId: string): Promise<void> {
  const [existing] = await db
    .select({ userId: watchHistory.userId })
    .from(watchHistory)
    .where(eq(watchHistory.id, entryId))
    .limit(1);

  if (!existing) throw new NotFoundError('History entry not found');
  if (existing.userId !== userId) throw new ForbiddenError('Cannot delete another user\'s history');

  await db.delete(watchHistory).where(eq(watchHistory.id, entryId));
}
