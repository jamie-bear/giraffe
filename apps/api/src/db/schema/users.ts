import { pgTable, uuid, varchar, text, jsonb, timestamp, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  debridApiKeyEncrypted: text('debrid_api_key_encrypted'),
  debridProvider: varchar('debrid_provider', { length: 50 }).default('real-debrid'),
  preferences: jsonb('preferences')
    .$type<{
      language: string;
      subtitleLanguage: string;
      preferredQuality: '720p' | '1080p' | '2160p';
      autoplay: boolean;
    }>()
    .default({
      language: 'en',
      subtitleLanguage: 'en',
      preferredQuality: '1080p',
      autoplay: true,
    }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
});
