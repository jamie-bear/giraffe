const sampleContent = [
  { id: 'movie:603', tmdbId: 603, mediaType: 'movie', title: 'The Matrix', year: 1999, genres: ['Action', 'Sci-Fi'], overview: 'A hacker discovers reality is a simulation.', trendingRank: 1 },
  { id: 'movie:27205', tmdbId: 27205, mediaType: 'movie', title: 'Inception', year: 2010, genres: ['Action', 'Sci-Fi'], overview: 'A thief enters dreams to steal secrets.', trendingRank: 2 },
  { id: 'tv:1399', tmdbId: 1399, mediaType: 'tv', title: 'Game of Thrones', year: 2011, genres: ['Fantasy', 'Drama'], overview: 'Noble families battle for control of Westeros.', trendingRank: 3 },
];

export class ContentService {
  trending(mediaType) {
    return sampleContent
      .filter((c) => !mediaType || c.mediaType === mediaType)
      .sort((a, b) => a.trendingRank - b.trendingRank);
  }

  search(query, mediaType) {
    const q = query.toLowerCase().trim();
    return sampleContent.filter((c) => (!mediaType || c.mediaType === mediaType) && c.title.toLowerCase().includes(q));
  }

  getByTmdbId(tmdbId, mediaType) {
    return sampleContent.find((c) => c.tmdbId === Number(tmdbId) && (!mediaType || c.mediaType === mediaType)) || null;
  }
}
