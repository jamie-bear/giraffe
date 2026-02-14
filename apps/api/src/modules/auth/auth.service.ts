import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users } from '../../db/schema/users.js';
import { refreshTokens } from '../../db/schema/watch-history.js';
import { AppError, UnauthorizedError } from '../../utils/errors.js';
import { config } from '../../config/index.js';

const SALT_ROUNDS = 12;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 days
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return value * (multipliers[unit] ?? 1000);
}

export async function registerUser(email: string, username: string, password: string) {
  const existingEmail = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existingEmail.length > 0) {
    throw new AppError(409, 'Conflict', 'Email already registered');
  }

  const existingUsername = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  if (existingUsername.length > 0) {
    throw new AppError(409, 'Conflict', 'Username already taken');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const [user] = await db
    .insert(users)
    .values({ email, username, passwordHash })
    .returning({ id: users.id, email: users.email, username: users.username });

  return user;
}

export async function verifyCredentials(email: string, password: string) {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      passwordHash: users.passwordHash,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  if (!user.isActive) {
    throw new UnauthorizedError('Account is deactivated');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Update last login
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

  return { id: user.id, email: user.email, username: user.username };
}

export async function createRefreshToken(userId: string): Promise<string> {
  const token = randomBytes(64).toString('hex');
  const tokenHash = hashToken(token);
  const expiresMs = parseExpiry(config.JWT_REFRESH_EXPIRY);
  const expiresAt = new Date(Date.now() + expiresMs);

  await db.insert(refreshTokens).values({ userId, tokenHash, expiresAt });

  return token;
}

export async function rotateRefreshToken(oldToken: string): Promise<{ userId: string; newToken: string }> {
  const oldHash = hashToken(oldToken);

  const [stored] = await db
    .select()
    .from(refreshTokens)
    .where(and(eq(refreshTokens.tokenHash, oldHash), gt(refreshTokens.expiresAt, new Date())))
    .limit(1);

  if (!stored) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  // Delete old token (single-use rotation)
  await db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id));

  // Issue new token
  const newToken = await createRefreshToken(stored.userId);
  return { userId: stored.userId, newToken };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
}
