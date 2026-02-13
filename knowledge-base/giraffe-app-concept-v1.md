---
In this document: Concept draft for Giraffe streaming app
App name: Giraffe
App URL: giraffe.watch
---
# Giraffe App Concept Draft

# Concept Summary
The goal is to create a progressive web app which provides an all-in-one solution for discovering, watching, rating, and playlisting movies and tv-shows. The app combines media centre features of Stremio (https://github.com/Stremio/stremio-core) with content guide and rating functionalities similar to justwatch.com and letterboxd.com.

The key features include:
* Secure user registration and sign-in
* Streaming of movies and tv-shows
* Subtitle support
* Dashboard with "Continue watching", "New", and "Trending" options
* Content discovery/explore page (media-type, genre, language, title search, ...)
* Creation and sharing of private and public playlists
* Release calendar for recent and upcoming movies and shows
* Internal 5-star content rating system
* Watch history

# Technical notes
The main source of the media content will be fetched from torrent hosting providers such as real-debrid and torbox, and the main source for media metadata will be sourced from The Movie Database (TMDB) via API calls. In order to facilitate this, the app's backend must include:

* Comprehensive metadata parsing, decoding, and filtering functionalities
* Metadata and catalog caching via Redis

## Media Parsing, Fetching, and Decoding
### Resolving Links
The app uses the debrid service's API to resolve magnet links into direct streaming URLs. Debrid services are capable of handling torrent files and provide high-speed access to these files by caching popular content on their servers.

### Fetching Metadata
The direct streaming URLs provided by debrid services often include metadata about the file. The app must parse this metadata to extract information such as video quality (e.g., 720p, 1080p), file size, codec type, language tracks, and available subtitles.

### Presenting Options
Using the parsed metadata, the optimal streaming option is selected automatically when the user selects an item within the app’s frontend. Further streaming options will only be presented to the user if they select “more sources” on the streaming page, allowing them to choose based on quality, language, or other preferences.

### Decoding with FFMpeg or Similar Tools
For more advanced metadata extraction, utilize libraries like FFMpeg, which can analyze media files to extract detailed information about their streams and tracks.

### Subtitles and Language
For subtitles, the app checks within the metadata for embedded subtitles, or alternatively, it could leverage subtitle services such as opensubtitles.com to fetch subtitles separately based on the language preference of the user.

## Developer / API Documentations
Real-debrid: https://api.real-debrid.com/
Torbox: https://api.torbox.app/docs
TMDB: https://developer.themoviedb.org/
Opensubtitles: https://opensubtitles.stoplight.io/docs/opensubtitles-api/
