import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users } from '../../db/schema/users.js';
import { encrypt } from '../../utils/crypto.js';
import { NotFoundError } from '../../utils/errors.js';
import type { UserProfile } from '@giraffe/shared';

export async function getProfile(userId: string): Promise<UserProfile> {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      preferences: users.preferences,
      debridProvider: users.debridProvider,
      debridApiKeyEncrypted: users.debridApiKeyEncrypted,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) throw new NotFoundError('User not found');

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    preferences: user.preferences as UserProfile['preferences'],
    debridProvider: user.debridProvider,
    hasDebridKey: !!user.debridApiKeyEncrypted,
  };
}

export async function updateProfile(
  userId: string,
  data: {
    username?: string;
    preferences?: Partial<{
      language: string;
      subtitleLanguage: string;
      preferredQuality: '720p' | '1080p' | '2160p';
      autoplay: boolean;
    }>;
  },
): Promise<UserProfile> {
  const current = await getProfile(userId);

  const updates: Record<string, unknown> = {};

  if (data.username) {
    updates.username = data.username;
  }

  if (data.preferences) {
    updates.preferences = {
      ...(current.preferences as object),
      ...data.preferences,
    };
  }

  if (Object.keys(updates).length > 0) {
    await db.update(users).set(updates).where(eq(users.id, userId));
  }

  return getProfile(userId);
}

export async function setDebridKey(
  userId: string,
  apiKey: string,
  provider: string,
): Promise<void> {
  const encrypted = encrypt(apiKey);
  await db
    .update(users)
    .set({ debridApiKeyEncrypted: encrypted, debridProvider: provider })
    .where(eq(users.id, userId));
}

export async function removeDebridKey(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ debridApiKeyEncrypted: null, debridProvider: 'real-debrid' })
    .where(eq(users.id, userId));
}
