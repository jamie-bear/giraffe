---
In this document: Concept draft for Giraffe streaming app
App name: Giraffe
App URL: giraffe.watch
---

# Giraffe Streaming App - Technical Specification

## 1. Executive Summary

**Vision**: An all-in-one progressive web app that combines streaming, discovery, and social features for movies and TV shows.

**Core Value Proposition**: Unified platform merging media center capabilities (Stremio-like), content discovery (JustWatch-style), and social rating, and playlisting features (Letterboxd-inspired).

**Target Platform**: Progressive Web App (PWA) for cross-platform compatibility

---

## 2. Core Features

### 2.1 User Management
- Secure registration and authentication system
- User profile management
- User preferences page, including managment of user API keys (see 3.1: Data sources)
- Privacy settings for playlists

### 2.2 Content Streaming
- Movies and TV shows playback
- Multi-quality streaming options (720p, 1080p, 4K)
- Embedded and external subtitle support
- Multi-language audio track selection
- Playback state persistence (resume watching)
- Movie/TV-show "product"-page with plot description, cast list, crew-list, release year, and ratings

### 2.3 Content Discovery
- **Dashboard**: Continue watching, New releases, Trending content
- **Explore/Browse**: 
  - Filter by media type (movie/TV)
  - Filter by genre, language, release year
  - Full-text title search
  - Advanced filters (rating, runtime, cast, crew)
- **Release Calendar**: Upcoming and recent releases timeline in a weekly/7-day display format and navigation for "previous week" and "next week"

### 2.4 Social & Organization Features
- 5-star internal rating system (use half-star inverval)
- Playlist creation and management
  - Private playlists
  - Public shareable playlists
  - Dedicated explore public playlists page
  - Collaborative playlists (future consideration)
- Watch history tracking
- Watchlist functionality

---

## 3. Technical Architecture

### 3.1 Data Sources

#### Primary Content Providers
| Service | Purpose | API Documentation |
|---------|---------|-------------------|
| **Real-Debrid** | Torrent resolution & streaming | https://api.real-debrid.com/ |
| **Torbox** | Alternative debrid service | https://api.torbox.app/docs |
| **TMDB** | Metadata (titles, posters, cast, ratings) | https://developer.themoviedb.org/ |
| **OpenSubtitles** | Subtitle fetching | https://opensubtitles.stoplight.io/docs/opensubtitles-api/ |

### 3.2 Backend Requirements

#### Core Services
1. **Authentication Service**
   - JWT-based authentication
   - OAuth2 support (optional)
   - Session management

2. **Metadata Service**
   - TMDB API integration
   - Metadata normalization and enrichment
   - Search indexing
   - Redis caching layer

3. **Streaming Resolution Service**
   - Debrid API integration
   - Magnet link → Direct URL resolution
   - Quality detection and ranking
   - Fallback provider handling

4. **Content Parsing Service**
   - Torrent metadata extraction
   - Quality detection (resolution, codec, bitrate)
   - Audio track detection
   - Subtitle detection
   - File naming convention parsing

5. **User Data Service**
   - Watch history management
   - Playlist CRUD operations
   - Rating system
   - User preferences

#### Caching Strategy
- **Redis** for:
  - TMDB metadata (TTL: 24-48 hours)
  - Popular content catalog (TTL: 6-12 hours)
  - Resolved streaming URLs (TTL: 1-4 hours)
  - User session data
  - Search query results

---

## 4. Streaming Workflow

### 4.1 Content Selection Flow
```
User selects content
    ↓
Fetch TMDB metadata
    ↓
Query debrid service for available torrents
    ↓
Parse and rank available sources
    ↓
(Maybe: Cache metadata for other users accessing the same content)
    ↓
Auto-select optimal source (based on quality/availability)
    ↓
Resolve to direct streaming URL
    ↓
Begin playback
```

### 4.2 Metadata Parsing Pipeline

#### Input: Torrent/File Information
- File name
- File size
- Seeders/leechers (if available)
- Debrid service metadata

#### Parsing Steps
1. **Quality Extraction**
   - Resolution: 480p, 720p, 1080p, 2160p (4K)
   - Source: WEB-DL, BluRay, HDTV, CAM, etc.
   - Codec: H.264, H.265/HEVC, AV1

2. **Audio Information**
   - Available language tracks
   - Audio codec (AAC, DTS, Dolby Digital)
   - Channel configuration (2.0, 5.1, 7.1)

3. **Subtitle Detection**
   - Embedded subtitle languages
   - External subtitle availability check

4. **Release Group & Edition**
   - Release group name
   - Edition tags (Extended, Director's Cut, IMAX)

#### Processing Tools
- **FFprobe/FFmpeg**: Deep media analysis for direct files
- **Regex patterns**: Filename parsing for torrent metadata
- **Libraries**: Consider `parse-torrent-title`, `torrent-name-parser` (Node.js)

### 4.3 Source Selection Algorithm

**Priority Ranking Factors:**
1. Video quality (higher = better)
2. Source reliability (BluRay > WEB-DL > HDTV > CAM)
3. File size optimization (balance quality/size)
4. Availability (seeders, debrid cache status)
5. Codec efficiency (AV1 > H.265 > H.264)
6. Language match with user preference

**User Override**: "More Sources" button shows all options with:
- Quality badge
- File size
- Language indicators
- Subtitle availability icons

---

## 5. Data Models (Preliminary)

### User
```
- id
- email
- username
- password_hash
- preferences (JSON: language, quality, autoplay, etc.)
- created_at
- last_login
```

### Content (cached from TMDB)
```
- tmdb_id
- type (movie/tv)
- title
- release_date
- poster_url
- backdrop_url
- genres[]
- runtime
- overview
- cached_at
```

### UserRating
```
- id
- user_id
- content_id
- rating (1-5 stars)
- review_text
- created_at
```

### Playlist
```
- id
- user_id
- name
- description
- is_public
- items[] (content_ids)
- created_at
- updated_at
```

### WatchHistory
```
- id
- user_id
- content_id
- progress_seconds
- completed
- last_watched
```

---

## 6. MVP Scope Prioritization

### Phase 1 - Essential (MVP)
- ✅ User authentication
- ✅ Basic streaming (single debrid provider)
- ✅ TMDB metadata integration
- ✅ Simple dashboard (continue watching, trending)
- ✅ Basic search and browse
- ✅ Watch history
- ✅ 5-star rating system

### Phase 2 - Enhanced Discovery
- 🔄 Advanced filtering
- 🔄 Release calendar
- 🔄 Playlist creation
- 🔄 Public playlist sharing
- 🔄 Multiple debrid provider support

### Phase 3 - Social Features
- 📅 User reviews/comments
- 📅 Social following
- 📅 Collaborative playlists
- 📅 Activity feed

---

## 7. Technical Considerations

### Performance Optimization
- Implement CDN for static assets (posters, backdrops)
- Lazy loading for content grids
- Virtual scrolling for large lists
- Service worker for offline capability (PWA)
- Progressive image loading

### Scalability
- Stateless backend services
- Horizontal scaling for API servers
- Database read replicas for high read loads
- Queue system for background jobs (metadata updates, cache warming)

### Security
- Rate limiting on API endpoints
- Input sanitization and validation
- HTTPS enforcement
- Secure credential storage (encrypted debrid API keys)
- CORS policy configuration

### Error Handling
- Graceful degradation when debrid services are unavailable
- Fallback to alternative providers
- User-friendly error messages
- Retry logic with exponential backoff

---

## 8. Open Questions / Decisions Needed

1. **Backend Framework**: Node.js (Express/Fastify), Python (FastAPI), Go?
2. **Frontend Framework**: React, Vue, Svelte?
3. **Database**: PostgreSQL, MongoDB, or hybrid?
4. **Hosting**: Cloud provider (AWS, GCP, Azure) or self-hosted?
5. **User Debrid Credentials**: How to handle? (User provides own API key vs. app-level service)
6. **Monetization Strategy**: Free, freemium, subscription?
7. **Legal Considerations**: Content streaming legality, DMCA compliance, geo-restrictions

---

## 9. External Resources

- **Real-Debrid API**: https://api.real-debrid.com/
- **Torbox API**: https://api.torbox.app/docs
- **TMDB API**: https://developer.themoviedb.org/
- **OpenSubtitles API**: https://opensubtitles.stoplight.io/docs/opensubtitles-api/
- **Stremio Core** (reference): https://github.com/Stremio/stremio-core
