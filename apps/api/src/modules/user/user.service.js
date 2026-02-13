export class UserService {
  constructor(store) {
    this.store = store;
  }

  dashboard(userId, contentService) {
    return {
      continueWatching: (this.store.watchHistory.get(userId) || []).slice(0, 10),
      trending: contentService.trending(),
      watchlist: this.store.watchlist.get(userId) || [],
    };
  }

  updateHistory(userId, payload) {
    const history = this.store.watchHistory.get(userId) || [];
    const idx = history.findIndex((h) => h.contentId === payload.contentId);
    const item = { ...payload, updatedAt: new Date().toISOString() };
    if (idx >= 0) history[idx] = item;
    else history.unshift(item);
    this.store.watchHistory.set(userId, history);
    return item;
  }

  rateContent(userId, payload) {
    if (payload.ratingHalfStars < 1 || payload.ratingHalfStars > 10) {
      throw new Error('Rating must be between 1 and 10 half-stars');
    }
    const key = `${userId}:${payload.contentId}`;
    const rating = { ...payload, userId, updatedAt: new Date().toISOString() };
    this.store.ratings.set(key, rating);
    return rating;
  }

  addWatchlist(userId, contentId) {
    const list = this.store.watchlist.get(userId) || [];
    if (!list.includes(contentId)) list.push(contentId);
    this.store.watchlist.set(userId, list);
    return list;
  }

  removeWatchlist(userId, contentId) {
    const list = (this.store.watchlist.get(userId) || []).filter((id) => id !== contentId);
    this.store.watchlist.set(userId, list);
    return list;
  }
}
