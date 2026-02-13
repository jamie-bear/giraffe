import crypto from 'node:crypto';

function hash(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export class AuthService {
  constructor(store) {
    this.store = store;
  }

  register({ email, username, password }) {
    if (!email || !username || !password) throw new Error('Missing required fields');
    if (this.store.usersByEmail.has(email)) throw new Error('Email already exists');

    const id = crypto.randomUUID();
    const user = {
      id,
      email,
      username,
      passwordHash: hash(password),
      preferredLanguage: 'en',
      preferredQuality: '1080p',
      createdAt: new Date().toISOString(),
    };

    this.store.users.set(id, user);
    this.store.usersByEmail.set(email, id);
    this.store.watchHistory.set(id, []);
    this.store.watchlist.set(id, []);
    return { id: user.id, email: user.email, username: user.username };
  }

  login({ email, password }) {
    const userId = this.store.usersByEmail.get(email);
    if (!userId) throw new Error('Invalid credentials');
    const user = this.store.users.get(userId);
    if (user.passwordHash !== hash(password)) throw new Error('Invalid credentials');

    const accessToken = crypto.randomBytes(24).toString('hex');
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const sessionId = crypto.randomUUID();

    this.store.sessions.set(accessToken, { userId, sessionId, expiresAt: Date.now() + 15 * 60 * 1000 });
    this.store.refreshTokens.set(refreshToken, { userId, sessionId, expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000 });
    return { accessToken, refreshToken, user: { id: user.id, email: user.email, username: user.username } };
  }

  me(accessToken) {
    const session = this.store.sessions.get(accessToken);
    if (!session || session.expiresAt < Date.now()) return null;
    const user = this.store.users.get(session.userId);
    if (!user) return null;
    return { id: user.id, email: user.email, username: user.username, preferredLanguage: user.preferredLanguage, preferredQuality: user.preferredQuality };
  }

  refresh(refreshToken) {
    const data = this.store.refreshTokens.get(refreshToken);
    if (!data || data.expiresAt < Date.now()) throw new Error('Invalid refresh token');
    this.store.refreshTokens.delete(refreshToken);

    const newAccess = crypto.randomBytes(24).toString('hex');
    const newRefresh = crypto.randomBytes(32).toString('hex');
    this.store.sessions.set(newAccess, { userId: data.userId, sessionId: data.sessionId, expiresAt: Date.now() + 15 * 60 * 1000 });
    this.store.refreshTokens.set(newRefresh, { userId: data.userId, sessionId: data.sessionId, expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000 });
    return { accessToken: newAccess, refreshToken: newRefresh };
  }

  logout(accessToken) {
    this.store.sessions.delete(accessToken);
  }
}
