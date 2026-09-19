/** Format USD amount with smart decimals depending on magnitude. */
export function fmtUsd(n: number, opts?: { forceDecimals?: number; sign?: boolean }): string {
  if (!Number.isFinite(n)) return "$0.00";
  const sign = n < 0 ? "-" : opts?.sign ? "+" : "";
  const abs = Math.abs(n);
  let decimals: number;
  if (opts?.forceDecimals !== undefined) {
    decimals = opts.forceDecimals;
  } else if (abs >= 1000) {
    decimals = 2;
  } else if (abs >= 1) {
    decimals = 2;
  } else if (abs >= 0.01) {
    decimals = 4;
  } else if (abs === 0) {
    decimals = 2;
  } else {
    decimals = 6;
  }
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${sign}$${formatted}`;
}

/** Compact format for big numbers: 1.2B, 345.6M, 12.3K */
export function fmtCompact(n: number): string {
  if (!Number.isFinite(n)) return "-";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toFixed(2);
}

/** Percent with sign: +4.52% / -1.20% */
export function fmtPct(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return "0.00%";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(decimals)}%`;
}

/** Quantity formatting: trims trailing zeros, handles tiny amounts. */
export function fmtQty(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs === 0) return "0";
  if (abs >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (abs >= 1) return n.toFixed(4).replace(/\.?0+$/, "");
  if (abs >= 0.0001) return n.toFixed(6).replace(/\.?0+$/, "");
  return n.toFixed(8).replace(/\.?0+$/, "");
}

/** Relative time in Indonesian, e.g. "2 mnt lalu". */
export function timeAgoId(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const s = Math.floor(diff / 1000);
  if (s < 10) return "baru saja";
  if (s < 60) return `${s} detik lalu`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  return `${h} jam lalu`;
}

/** HH:MM, DD MMM formats for timestamps */
export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) +
    " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}
