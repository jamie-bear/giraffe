'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, setAccessToken, getAccessToken } from '@/lib/api-client';
import type { User } from '@giraffe/shared';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Module-level promise to deduplicate the initial refresh across strict-mode double-mounts
let restorePromise: Promise<User | null> | null = null;

async function doRestore(): Promise<User | null> {
  try {
    const data = await apiClient<{ accessToken: string }>('/auth/refresh', {
      method: 'POST',
    });
    setAccessToken(data.accessToken);
    const profile = await apiClient<User>('/user/profile');
    return profile;
  } catch {
    setAccessToken(null);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    const restore = async () => {
      if (getAccessToken()) {
        // Already have a token in memory, just fetch profile
        try {
          const profile = await apiClient<User>('/user/profile');
          setState({ user: profile, isLoading: false, isAuthenticated: true });
        } catch {
          setState({ user: null, isLoading: false, isAuthenticated: false });
        }
        return;
      }

      // Deduplicate: reuse in-flight refresh promise if one already exists
      if (!restorePromise) {
        restorePromise = doRestore();
      }

      const profile = await restorePromise;
      restorePromise = null;

      if (profile) {
        setState({ user: profile, isLoading: false, isAuthenticated: true });
      } else {
        setState({ user: null, isLoading: false, isAuthenticated: false });
      }
    };

    restore();
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await apiClient<{ user: User; accessToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAccessToken(data.accessToken);
      setState({ user: data.user as User, isLoading: false, isAuthenticated: true });
      router.push('/dashboard');
    },
    [router],
  );

  const register = useCallback(
    async (email: string, username: string, password: string) => {
      const data = await apiClient<{ user: User; accessToken: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, username, password }),
      });
      setAccessToken(data.accessToken);
      setState({ user: data.user as User, isLoading: false, isAuthenticated: true });
      router.push('/dashboard');
    },
    [router],
  );

  const logout = useCallback(async () => {
    try {
      await apiClient('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore errors during logout
    }
    setAccessToken(null);
    setState({ user: null, isLoading: false, isAuthenticated: false });
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
