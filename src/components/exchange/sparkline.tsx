"use client";

import { useId, useMemo } from "react";
import { cn } from "@/lib/utils";

interface SparklineProps {
  data: number[];
  up: boolean;
  width?: number;
  height?: number;
  strokeWidth?: number;
  showArea?: boolean;
  className?: string;
}

/** Lightweight SVG line/area chart from a price series. */
export function Sparkline({
  data,
  up,
  width = 100,
  height = 36,
  strokeWidth = 1.6,
  showArea = true,
  className,
}: SparklineProps) {
  const gradientId = useId();
  const { linePath, areaPath, min, max } = useMemo(() => {
    const pts = data.filter((v) => Number.isFinite(v));
    if (pts.length < 2) return { linePath: "", areaPath: "", min: 0, max: 0 };
    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const range = max - min || 1;
    const pad = strokeWidth + 1;
    const x = (i: number) => (i / (pts.length - 1)) * width;
    const y = (v: number) => height - pad - ((v - min) / range) * (height - pad * 2);
    let line = `M ${x(0).toFixed(2)} ${y(pts[0]).toFixed(2)}`;
    for (let i = 1; i < pts.length; i++) {
      line += ` L ${x(i).toFixed(2)} ${y(pts[i]).toFixed(2)}`;
    }
    const area = `${line} L ${width} ${height} L 0 ${height} Z`;
    return { linePath: line, areaPath: area, min, max };
  }, [data, width, height, strokeWidth]);

  const color = up ? "#10b981" : "#ef4444";

  if (!linePath) {
    return <div className={cn("text-muted-foreground/40", className)} style={{ width, height }} aria-hidden />;
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn("overflow-visible", className)}
      role="img"
      aria-label={`Grafik harga, tertinggi ${max}, terendah ${min}`}
      preserveAspectRatio="none"
    >
      {showArea && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradientId})`} />
        </>
      )}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
