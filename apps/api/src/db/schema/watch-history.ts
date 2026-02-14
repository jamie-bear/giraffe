import {
  pgTable,
  uuid,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  smallint,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { content } from './content.js';

export const watchHistory = pgTable(
  'watch_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    contentId: uuid('content_id')
      .notNull()
      .references(() => content.id, { onDelete: 'cascade' }),
    seasonNumber: smallint('season_number'),
    episodeNumber: smallint('episode_number'),
    progressSeconds: integer('progress_seconds').default(0).notNull(),
    durationSeconds: integer('duration_seconds'),
    completed: boolean('completed').default(false).notNull(),
    lastWatchedAt: timestamp('last_watched_at', { withTimezone: true }).defaultNow().notNull(),
    sourceInfo: varchar('source_info', { length: 500 }),
  },
  (table) => [
    uniqueIndex('watch_history_user_content_episode_idx').on(
      table.userId,
      table.contentId,
      table.seasonNumber,
      table.episodeNumber,
    ),
    index('watch_history_user_last_watched_idx').on(table.userId, table.lastWatchedAt),
  ],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 128 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('refresh_tokens_user_idx').on(table.userId),
    index('refresh_tokens_expires_idx').on(table.expiresAt),
  ],
);
