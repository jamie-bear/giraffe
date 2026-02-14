'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';

interface SearchBarProps {
  initialQuery?: string;
}

export function SearchBar({ initialQuery = '' }: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    },
    [query, router],
  );

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search movies and TV shows..."
        className="text-base"
      />
    </form>
  );
}
