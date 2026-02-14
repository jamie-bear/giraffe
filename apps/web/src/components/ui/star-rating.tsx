'use client';

import { useState, useCallback } from 'react';

interface StarRatingProps {
  value: number; // 1-10 (display as 0.5-5 stars)
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = { sm: 16, md: 20, lg: 24 };

export function StarRating({ value, onChange, readOnly = false, size = 'md' }: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const displayValue = hoverValue ?? value;
  const starSize = sizeMap[size];

  const handleClick = useCallback(
    (starIndex: number, isHalf: boolean) => {
      if (readOnly || !onChange) return;
      const newValue = isHalf ? starIndex * 2 - 1 : starIndex * 2;
      onChange(newValue);
    },
    [readOnly, onChange],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>, starIndex: number) => {
      if (readOnly) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const isHalf = e.clientX - rect.left < rect.width / 2;
      setHoverValue(isHalf ? starIndex * 2 - 1 : starIndex * 2);
    },
    [readOnly],
  );

  return (
    <div className="inline-flex items-center gap-0.5" onMouseLeave={() => setHoverValue(null)}>
      {[1, 2, 3, 4, 5].map((starIndex) => {
        const fillLevel = Math.min(Math.max(displayValue - (starIndex - 1) * 2, 0), 2);
        // 0 = empty, 1 = half, 2 = full

        return (
          <span
            key={starIndex}
            className={readOnly ? '' : 'cursor-pointer'}
            onMouseMove={(e) => handleMouseMove(e, starIndex)}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const isHalf = e.clientX - rect.left < rect.width / 2;
              handleClick(starIndex, isHalf);
            }}
          >
            <svg
              width={starSize}
              height={starSize}
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id={`star-fill-${starIndex}-${value}`}>
                  <stop
                    offset={fillLevel >= 2 ? '100%' : fillLevel >= 1 ? '50%' : '0%'}
                    stopColor="var(--color-star)"
                  />
                  <stop
                    offset={fillLevel >= 2 ? '100%' : fillLevel >= 1 ? '50%' : '0%'}
                    stopColor="var(--color-border)"
                  />
                </linearGradient>
              </defs>
              <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                fill={`url(#star-fill-${starIndex}-${value})`}
              />
            </svg>
          </span>
        );
      })}
      <span className="ml-1 text-sm text-text-secondary">{(displayValue / 2).toFixed(1)}</span>
    </div>
  );
}
