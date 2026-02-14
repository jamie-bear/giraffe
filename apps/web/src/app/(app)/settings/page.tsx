'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import type { UserProfile } from '@giraffe/shared';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery({
    queryKey: ['user', 'profile'],
    queryFn: () => apiClient<UserProfile>('/user/profile'),
  });

  const [debridKey, setDebridKey] = useState('');
  const [debridProvider, setDebridProvider] = useState('real-debrid');
  const [preferredQuality, setPreferredQuality] = useState('1080p');
  const [language, setLanguage] = useState('en');

  useEffect(() => {
    if (profile) {
      setDebridProvider(profile.debridProvider ?? 'real-debrid');
      setPreferredQuality(profile.preferences.preferredQuality);
      setLanguage(profile.preferences.language);
    }
  }, [profile]);

  const updatePrefs = useMutation({
    mutationFn: (prefs: Record<string, unknown>) =>
      apiClient('/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ preferences: prefs }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'profile'] });
    },
  });

  const saveDebridKey = useMutation({
    mutationFn: () =>
      apiClient('/user/debrid-key', {
        method: 'PUT',
        body: JSON.stringify({ apiKey: debridKey, provider: debridProvider }),
      }),
    onSuccess: () => {
      setDebridKey('');
      queryClient.invalidateQueries({ queryKey: ['user', 'profile'] });
    },
  });

  const removeDebridKey = useMutation({
    mutationFn: () => apiClient('/user/debrid-key', { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'profile'] });
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>

      {/* Profile */}
      <Card className="mb-6 p-5">
        <h2 className="mb-4 text-lg font-semibold">Profile</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-text-secondary">Email</span>
            <span>{profile?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Username</span>
            <span>{profile?.username}</span>
          </div>
        </div>
      </Card>

      {/* Preferences */}
      <Card className="mb-6 p-5">
        <h2 className="mb-4 text-lg font-semibold">Preferences</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm text-text-secondary">Preferred Quality</label>
            <select
              value={preferredQuality}
              onChange={(e) => setPreferredQuality(e.target.value)}
              className="rounded-lg border border-border bg-bg-tertiary px-3 py-1.5 text-sm text-text"
            >
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
              <option value="2160p">4K</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm text-text-secondary">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="rounded-lg border border-border bg-bg-tertiary px-3 py-1.5 text-sm text-text"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="ja">Japanese</option>
              <option value="ko">Korean</option>
            </select>
          </div>
          <Button
            size="sm"
            onClick={() =>
              updatePrefs.mutate({ preferredQuality, language })
            }
            disabled={updatePrefs.isPending}
          >
            {updatePrefs.isPending ? 'Saving...' : 'Save Preferences'}
          </Button>
        </div>
      </Card>

      {/* Debrid API Key */}
      <Card className="p-5">
        <h2 className="mb-4 text-lg font-semibold">Debrid Service</h2>

        {profile?.hasDebridKey ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-success">API key configured</p>
                <p className="text-xs text-text-muted">
                  Provider: {profile.debridProvider}
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => removeDebridKey.mutate()}
                disabled={removeDebridKey.isPending}
              >
                Remove Key
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Connect your debrid service to start streaming. Your API key is encrypted at rest.
            </p>
            <div className="flex items-end gap-3">
              <select
                value={debridProvider}
                onChange={(e) => setDebridProvider(e.target.value)}
                className="rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text"
              >
                <option value="real-debrid">Real-Debrid</option>
                <option value="torbox">Torbox</option>
              </select>
              <div className="flex-1">
                <Input
                  value={debridKey}
                  onChange={(e) => setDebridKey(e.target.value)}
                  placeholder="Paste your API key"
                  type="password"
                />
              </div>
              <Button
                onClick={() => saveDebridKey.mutate()}
                disabled={!debridKey || saveDebridKey.isPending}
              >
                {saveDebridKey.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
