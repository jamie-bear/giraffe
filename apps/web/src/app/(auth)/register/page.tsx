'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function RegisterPage() {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register(email, username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center relative overflow-hidden bg-bg-secondary">
        {/* Accent glow */}
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute -bottom-48 -right-24 h-[500px] w-[500px] rounded-full bg-accent/5 blur-3xl" />

        <div className="relative z-10 px-12 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/giraffe-logo-icon-v1.1.svg"
            alt=""
            className="mx-auto mb-8 h-28 w-28 drop-shadow-lg"
          />
          <h1 className="font-heading text-5xl text-text">Giraffe</h1>
          <p className="mt-3 text-lg tracking-widest text-accent uppercase">See Everything.</p>
          <div className="mx-auto mt-10 h-px w-24 bg-border" />
          <p className="mt-6 max-w-xs mx-auto text-sm leading-relaxed text-text-muted">
            Your personal media center. Stream movies and TV shows from your library, anywhere.
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex w-full lg:w-1/2 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile-only branding */}
          <div className="mb-10 flex flex-col items-center lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/giraffe-logo-icon-v1.1.svg" alt="Giraffe" className="mb-4 h-16 w-16" />
            <h1 className="font-heading text-3xl text-text">Giraffe</h1>
            <p className="mt-1 text-xs tracking-widest text-accent uppercase">See Everything.</p>
          </div>

          <div className="mb-8">
            <h2 className="font-heading text-2xl text-text">Create your account</h2>
            <p className="mt-1 text-sm text-text-muted">
              Get started with your personal media center
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Input
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
            <Input
              id="username"
              label="Username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose a username"
              required
              minLength={3}
              maxLength={50}
            />
            <Input
              id="password"
              label="Password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              minLength={8}
            />

            {error && (
              <div className="rounded-lg border border-error/30 bg-error/10 px-3 py-2">
                <p className="text-sm text-error">{error}</p>
              </div>
            )}

            <Button type="submit" disabled={loading} className="mt-1 h-11">
              {loading ? 'Creating account...' : 'Create account'}
            </Button>
          </form>

          <div className="mt-8 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-text-muted">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <p className="mt-6 text-center text-sm text-text-secondary">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-accent hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
