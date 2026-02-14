'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/dashboard" className="text-xl font-bold text-accent">
          Giraffe
        </Link>

        <nav className="flex items-center gap-4">
          <Link href="/search" className="text-sm text-text-secondary hover:text-text">
            Search
          </Link>
          <Link href="/browse" className="text-sm text-text-secondary hover:text-text">
            Browse
          </Link>
          <Link href="/history" className="text-sm text-text-secondary hover:text-text">
            History
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {user && (
            <>
              <Link href="/settings" className="text-sm text-text-secondary hover:text-text">
                {user.username}
              </Link>
              <Button variant="ghost" size="sm" onClick={logout}>
                Log out
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
