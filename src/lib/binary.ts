import "server-only";
import { db } from "@/lib/db";
import { getCoinPrice } from "@/lib/market-data";
import { BINARY_DURATIONS, MIN_BINARY_BET_USD } from "@/lib/types";
import type {
  BinaryControlMode,
  BinaryDirection,
  BinaryOrderView,
  BinaryStatus,
} from "@/lib/types";

export { BINARY_DURATIONS, MIN_BINARY_BET_USD };

const EXPIRY_MINS = BINARY_DURATIONS.map((d) => d.min);

export function isValidExpiry(min: number): boolean {
  return EXPIRY_MINS.includes(min);
}

/** Persentase profit mengikuti durasi (5 menit → 5%, dst). */
export function profitPctFor(min: number): number {
  return BINARY_DURATIONS.find((d) => d.min === min)?.pct ?? 5;
}

/** Mode kontrol arah harga untuk sebuah simbol (default AUTO). */
export async function getControlMode(symbol: string): Promise<BinaryControlMode> {
  const row = await db.tradeControl.findUnique({ where: { symbol } });
  if (row && ["AUTO", "UP", "DOWN"].includes(row.mode)) return row.mode as BinaryControlMode;
  return "AUTO";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function mapOrder(o: {
  id: string;
  coinId: string;
  symbol: string;
  direction: string;
  amountUsd: number;
  profitPct: number;
  entryPrice: number;
  resultPrice: number | null;
  expiryMin: number;
  status: string;
  payoutUsd: number | null;
  forceResult: string | null;
  createdAt: Date;
  expiresAt: Date;
  settledAt: Date | null;
}): BinaryOrderView {
  return {
    id: o.id,
    coinId: o.coinId,
    symbol: o.symbol,
    direction: o.direction as BinaryDirection,
    amountUsd: o.amountUsd,
    profitPct: o.profitPct,
    entryPrice: o.entryPrice,
    resultPrice: o.resultPrice,
    expiryMin: o.expiryMin,
    status: o.status as BinaryStatus,
    payoutUsd: o.payoutUsd,
    forceResult: (o.forceResult as "WIN" | "LOSE" | null) ?? null,
    createdAt: o.createdAt.toISOString(),
    expiresAt: o.expiresAt.toISOString(),
    settledAt: o.settledAt?.toISOString() ?? null,
  };
}

export { mapOrder };

interface SettleInput {
  id: string;
  userId: string;
  coinId: string;
  symbol: string;
  direction: string;
  amountUsd: number;
  profitPct: number;
  entryPrice: number;
  forceResult: string | null;
  status: string;
}

/**
 * Settle satu order opsi (hanya jika masih PENDING).
 * outcome: "WIN" | "LOSE" | "AUTO" — AUTO mengikuti kontrol admin / harga pasar nyata.
 * Mengembalikan order terbaru atau null jika sudah disettle proses lain.
 */
export async function settleBinaryOrder(
  order: SettleInput,
  outcome: "WIN" | "LOSE" | "AUTO" = "AUTO"
): Promise<BinaryOrderView | null> {
  if (order.status !== "PENDING") return null;

  let status: BinaryStatus;
  let resultPrice: number;
  const forced = outcome !== "AUTO" ? outcome : order.forceResult; // WIN | LOSE | null

  if (forced === "WIN" || forced === "LOSE") {
    status = forced === "WIN" ? "WON" : "LOST";
    // harga hasil konsisten untuk tampilan: naik/turun 0.5% dari entry
    const wonUp = status === "WON" ? order.direction === "UP" : order.direction === "DOWN";
    resultPrice = round2(order.entryPrice * (wonUp ? 1.005 : 0.995));
    // simpan jejak paksaan admin untuk audit
    if (order.forceResult !== forced) {
      await db.binaryOrder.update({ where: { id: order.id }, data: { forceResult: forced } });
      order.forceResult = forced;
    }
  } else {
    const mode = await getControlMode(order.symbol);
    if (mode === "UP" || mode === "DOWN") {
      // Admin memaksa arah harga: UP → opsi Naik menang, DOWN → opsi Turun menang.
      const marketWentUp = mode === "UP";
      const userWon = (order.direction === "UP") === marketWentUp;
      status = userWon ? "WON" : "LOST";
      resultPrice = round2(order.entryPrice * (marketWentUp ? 1.005 : 0.995));
    } else {
      // AUTO: bandingkan dengan harga pasar nyata saat settle.
      const live = await getCoinPrice(order.coinId);
      if (!live) {
        // harga tak tersedia (offline) → anggap seri, refund stake agar adil
        status = "DRAW";
        resultPrice = order.entryPrice;
      } else {
        resultPrice = live.price;
        if (resultPrice === order.entryPrice) {
          status = "DRAW";
        } else {
          const marketWentUp = resultPrice > order.entryPrice;
          const userWon = (order.direction === "UP") === marketWentUp;
          status = userWon ? "WON" : "LOST";
        }
      }
    }
  }

  const payoutUsd =
    status === "WON"
      ? round2(order.amountUsd * (1 + order.profitPct / 100))
      : status === "DRAW"
        ? round2(order.amountUsd)
        : 0;

  // Klaim atomik: hanya satu proses yang berhasil mengubah PENDING → final.
  const claimed = await db.binaryOrder.updateMany({
    where: { id: order.id, status: "PENDING" },
    data: { status, resultPrice, payoutUsd, settledAt: new Date() },
  });
  if (claimed.count === 0) return null;

  if (payoutUsd > 0) {
    await db.$transaction([
      db.user.update({ where: { id: order.userId }, data: { cashUsd: { increment: payoutUsd } } }),
      db.transaction.create({
        data: {
          userId: order.userId,
          type: status === "WON" ? "BINARY_WIN" : "BINARY_REFUND",
          amountUsd: payoutUsd,
          note:
            status === "WON"
              ? `Opsi ${order.direction === "UP" ? "Naik" : "Turun"} ${order.symbol} menang (${order.profitPct}%)`
              : `Opsi ${order.symbol} seri — stake dikembalikan`,
          status: "COMPLETED",
        },
      }),
    ]);
  }

  const fresh = await db.binaryOrder.findUnique({ where: { id: order.id } });
  return fresh ? mapOrder(fresh) : null;
}

/** Settle semua order yang sudah kedaluwarsa. Return jumlah yang disettle. */
export async function settleDueBinaryOrders(): Promise<number> {
  const due = await db.binaryOrder.findMany({
    where: { status: "PENDING", expiresAt: { lte: new Date() } },
    orderBy: { expiresAt: "asc" },
    take: 50,
  });
  let count = 0;
  for (const o of due) {
    const res = await settleBinaryOrder(o, "AUTO");
    if (res) count += 1;
  }
  return count;
}
