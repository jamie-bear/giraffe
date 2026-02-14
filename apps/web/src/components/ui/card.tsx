import type { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export function Card({ hover = false, className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface ${hover ? 'transition-colors hover:border-text-muted cursor-pointer' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
