'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, setAccessToken, getAccessToken } from '@/lib/api-client';
import type { User } from '@giraffe/shared';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useAuth() {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Try to restore session on mount
  useEffect(() => {
    const restore = async () => {
      try {
        // Attempt a token refresh to restore session from httpOnly cookie
        const data = await apiClient<{ accessToken: string }>('/auth/refresh', {
          method: 'POST',
        });
        setAccessToken(data.accessToken);

        // Fetch profile
        const profile = await apiClient<User>('/user/profile');
        setState({ user: profile, isLoading: false, isAuthenticated: true });
      } catch {
        setState({ user: null, isLoading: false, isAuthenticated: false });
      }
    };

    if (!getAccessToken()) {
      restore();
    } else {
      // Already have a token, fetch profile
      apiClient<User>('/user/profile')
        .then((profile) => setState({ user: profile, isLoading: false, isAuthenticated: true }))
        .catch(() => setState({ user: null, isLoading: false, isAuthenticated: false }));
    }
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

  return { ...state, login, register, logout };
}
