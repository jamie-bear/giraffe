import pg from 'pg';

const migration = `
-- Enable uuid extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create content_type enum
DO $$ BEGIN
  CREATE TYPE content_type AS ENUM ('movie', 'tv');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  debrid_api_key_encrypted TEXT,
  debrid_provider VARCHAR(50) DEFAULT 'real-debrid',
  preferences JSONB DEFAULT '{"language":"en","subtitleLanguage":"en","preferredQuality":"1080p","autoplay":true}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- Content table
CREATE TABLE IF NOT EXISTS content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tmdb_id INTEGER NOT NULL,
  content_type content_type NOT NULL,
  title VARCHAR(500) NOT NULL,
  original_title VARCHAR(500),
  overview TEXT,
  poster_path VARCHAR(255),
  backdrop_path VARCHAR(255),
  release_date DATE,
  runtime INTEGER,
  number_of_seasons INTEGER,
  number_of_episodes INTEGER,
  genres JSONB DEFAULT '[]'::jsonb,
  vote_average INTEGER,
  original_language VARCHAR(10),
  status VARCHAR(50),
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS content_tmdb_type_idx ON content (tmdb_id, content_type);
CREATE INDEX IF NOT EXISTS content_title_idx ON content (title);
CREATE INDEX IF NOT EXISTS content_release_date_idx ON content (release_date);

-- Ratings table
CREATE TABLE IF NOT EXISTS ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL,
  review_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ratings_user_content_idx ON ratings (user_id, content_id);
CREATE INDEX IF NOT EXISTS ratings_content_idx ON ratings (content_id);

-- Playlists table
CREATE TABLE IF NOT EXISTS playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS playlists_user_idx ON playlists (user_id);

-- Playlist items table
CREATE TABLE IF NOT EXISTS playlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS playlist_items_playlist_idx ON playlist_items (playlist_id);
CREATE INDEX IF NOT EXISTS playlist_items_position_idx ON playlist_items (playlist_id, position);

-- Watch history table
CREATE TABLE IF NOT EXISTS watch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  season_number SMALLINT,
  episode_number SMALLINT,
  progress_seconds INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER,
  completed BOOLEAN NOT NULL DEFAULT false,
  last_watched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_info VARCHAR(500)
);

CREATE UNIQUE INDEX IF NOT EXISTS watch_history_user_content_episode_idx ON watch_history (user_id, content_id, season_number, episode_number);
CREATE INDEX IF NOT EXISTS watch_history_user_last_watched_idx ON watch_history (user_id, last_watched_at);

-- Refresh tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_expires_idx ON refresh_tokens (expires_at);
`;

export async function runMigrations(databaseUrl: string): Promise<void> {
  const client = new pg.Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    console.log('Connected to database, running migrations...');
    await client.query(migration);
    console.log('Database migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    await client.end();
  }
}
