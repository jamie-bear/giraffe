import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  jsonb,
  date,
  timestamp,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';

export const contentTypeEnum = pgEnum('content_type', ['movie', 'tv']);

export const content = pgTable(
  'content',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tmdbId: integer('tmdb_id').notNull(),
    contentType: contentTypeEnum('content_type').notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    originalTitle: varchar('original_title', { length: 500 }),
    overview: text('overview'),
    posterPath: varchar('poster_path', { length: 255 }),
    backdropPath: varchar('backdrop_path', { length: 255 }),
    releaseDate: date('release_date'),
    runtime: integer('runtime'),
    numberOfSeasons: integer('number_of_seasons'),
    numberOfEpisodes: integer('number_of_episodes'),
    genres: jsonb('genres').$type<{ id: number; name: string }[]>().default([]),
    voteAverage: integer('vote_average'),
    originalLanguage: varchar('original_language', { length: 10 }),
    status: varchar('status', { length: 50 }),
    cachedAt: timestamp('cached_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('content_tmdb_type_idx').on(table.tmdbId, table.contentType),
    index('content_title_idx').on(table.title),
    index('content_release_date_idx').on(table.releaseDate),
  ],
);
