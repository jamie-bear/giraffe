export interface UserPreferences {
  language: string;
  subtitleLanguage: string;
  preferredQuality: '720p' | '1080p' | '2160p';
  autoplay: boolean;
}

export interface User {
  id: string;
  email: string;
  username: string;
  preferences: UserPreferences;
  debridProvider: string | null;
  hasDebridKey: boolean;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  preferences: UserPreferences;
  debridProvider: string | null;
  hasDebridKey: boolean;
}
