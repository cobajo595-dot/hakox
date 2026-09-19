"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const LETTER_COLORS = [
  "#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed",
  "#0891b2", "#db2777", "#65a30d", "#ea580c", "#4f46e5",
];

interface CoinLogoProps {
  src: string;
  symbol: string;
  size?: number;
  className?: string;
}

/** Crypto coin logo with letter fallback when image fails to load. */
export function CoinLogo({ src, symbol, size = 32, className }: CoinLogoProps) {
  const [error, setError] = useState(false);
  const letter = symbol?.charAt(0) ?? "?";
  const colorIdx = (symbol?.charCodeAt(0) ?? 0) % LETTER_COLORS.length;

  if (error || !src) {
    return (
      <span
        aria-hidden
        className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white select-none", className)}
        style={{ width: size, height: size, backgroundColor: LETTER_COLORS[colorIdx], fontSize: size * 0.42 }}
      >
        {letter}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={`Logo ${symbol}`}
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setError(true)}
      className={cn("shrink-0 rounded-full object-cover bg-muted", className)}
      style={{ width: size, height: size }}
    />
  );
}
