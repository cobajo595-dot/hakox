"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Crown, Gift, Rocket, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface Slide {
  id: string;
  title: string;
  lines: string[];
  badge?: string;
  cta?: string;
  icon: React.ReactNode;
  gradient: string;
  onCta?: () => void;
}

interface BannerCarouselProps {
  onExplore?: () => void;
}

export function BannerCarousel({ onExplore }: BannerCarouselProps) {
  const slides: Slide[] = [
    {
      id: "security",
      title: "Awas penipuan!",
      lines: ["Jangan bagikan kata sandi atau", "kode API kepada siapa pun."],
      badge: "Resmi",
      cta: "Mulai Aman",
      icon: <ShieldCheck className="h-16 w-16 text-blue-400/80" strokeWidth={1.2} />,
      gradient: "from-[#0a1633] via-[#101f45] to-[#173573]",
      onCta: onExplore,
    },
    {
      id: "feature",
      title: "Bonus ekstra",
      lines: ["NFT, IEO, dan area", "pinjam dengan imbalan menarik."],
      cta: "Jelajahi",
      icon: <Rocket className="h-16 w-16 text-blue-300/80" strokeWidth={1.2} />,
      gradient: "from-[#0c1c3f] via-[#152a5c] to-[#1d4ed8]/70",
      onCta: onExplore,
    },
    {
      id: "vip",
      title: "Benefit member VIP",
      lines: ["Gratis USDT untuk top-up VIP,", "nikmati perlakuan eksklusif."],
      badge: "VIP",
      cta: "Lihat VIP",
      icon: <Crown className="h-16 w-16 text-amber-300/90" strokeWidth={1.2} />,
      gradient: "from-[#131c3d] via-[#1c2c5e] to-[#2563eb]/60",
      onCta: onExplore,
    },
  ];

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

  const go = useCallback(
    (dir: 1 | -1) => setIndex((i) => (i + dir + slides.length) % slides.length),
    [slides.length]
  );

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => go(1), 4500);
    return () => clearInterval(t);
  }, [go, paused]);

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
      role="region"
      aria-label="Banner promosi"
    >
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((s) => (
          <div key={s.id} className="w-full shrink-0">
            <div className={cn("relative flex items-center gap-3 overflow-hidden bg-gradient-to-br p-5", s.gradient)}>
              {/* decorative circles */}
              <div className="pointer-events-none absolute -top-8 -right-8 h-28 w-28 rounded-full bg-blue-500/20 blur-xl" />
              <div className="pointer-events-none absolute -bottom-10 right-16 h-20 w-20 rounded-full bg-blue-400/10 blur-lg" />
              <div className="min-w-0 flex-1">
                {s.badge && (
                  <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-blue-500/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                    <Gift className="h-3 w-3" /> {s.badge}
                  </span>
                )}
                <h3 className="text-base font-bold text-white sm:text-lg">{s.title}</h3>
                <p className="mt-1 text-[11px] leading-snug text-blue-200/90 sm:text-xs">
                  {s.lines[0]}
                  <br />
                  {s.lines[1]}
                </p>
                {s.cta && (
                  <button
                    onClick={s.onCta}
                    className="mt-3 rounded-full bg-white/95 px-3.5 py-1 text-[11px] font-semibold text-blue-700 transition hover:bg-white active:scale-95"
                  >
                    {s.cta}
                  </button>
                )}
              </div>
              <div className="relative shrink-0" aria-hidden>
                <div className="absolute inset-0 rounded-full bg-blue-400/20 blur-2xl" />
                {s.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* arrows (desktop) */}
      <button
        onClick={() => go(-1)}
        aria-label="Banner sebelumnya"
        className="absolute top-1/2 left-1.5 hidden -translate-y-1/2 rounded-full bg-black/25 p-1 text-white/90 transition hover:bg-black/40 sm:block"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        onClick={() => go(1)}
        aria-label="Banner berikutnya"
        className="absolute top-1/2 right-1.5 hidden -translate-y-1/2 rounded-full bg-black/25 p-1 text-white/90 transition hover:bg-black/40 sm:block"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {/* dots */}
      <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
        {slides.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setIndex(i)}
            aria-label={`Ke banner ${i + 1}`}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === index ? "w-4 bg-white" : "w-1.5 bg-white/50"
            )}
          />
        ))}
      </div>
    </div>
  );
}
