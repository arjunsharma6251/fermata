"use client";

// Half-star rating input, Letterboxd-fluent. Five glyphs, each with a
// left/right half hit zone; hover previews, click commits. Fill renders
// via an accent overlay clipped to width, so halves look right in any
// font. Display-only contexts should use starsText() from lib/ratings.

import { useState } from "react";

interface StarsInputProps {
  value: number; // 0 = unrated
  onChange: (stars: number) => void;
  size?: number;
}

export function StarsInput({ value, onChange, size = 22 }: StarsInputProps) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;

  return (
    <div
      style={{ display: "inline-flex", gap: 2 }}
      onMouseLeave={() => setHover(null)}
      role="slider"
      aria-label="your rating"
      aria-valuemin={0}
      aria-valuemax={5}
      aria-valuenow={value}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = Math.max(0, Math.min(1, shown - (star - 1))); // 0 | .5 | 1
        return (
          <span
            key={star}
            style={{
              position: "relative",
              display: "inline-block",
              fontSize: size,
              lineHeight: 1,
              color: "var(--line)",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            ★
            <span
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                width: `${fill * 100}%`,
                overflow: "hidden",
                color: "var(--accent)",
                transition: "width 0.1s ease-out",
              }}
            >
              ★
            </span>
            {/* half hit zones */}
            {[0.5, 1].map((half) => (
              <button
                key={half}
                aria-label={`${star - 1 + half} stars`}
                onMouseEnter={() => setHover(star - 1 + half)}
                onClick={() => onChange(star - 1 + half)}
                style={{
                  position: "absolute",
                  top: 0,
                  left: half === 0.5 ? 0 : "50%",
                  width: "50%",
                  height: "100%",
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                }}
              />
            ))}
          </span>
        );
      })}
    </div>
  );
}
