import { pgTable, uuid, smallint, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { content } from './content.js';

export const ratings = pgTable(
  'ratings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    contentId: uuid('content_id')
      .notNull()
      .references(() => content.id, { onDelete: 'cascade' }),
    rating: smallint('rating').notNull(), // 1-10 (half-star: display = value / 2)
    reviewText: text('review_text'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('ratings_user_content_idx').on(table.userId, table.contentId),
    index('ratings_content_idx').on(table.contentId),
  ],
);
