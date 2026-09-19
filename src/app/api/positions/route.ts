import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCoinPrice, getMarket } from "@/lib/market-data";
import { effectiveCashUsd } from "@/lib/balance";
import type { PositionView } from "@/lib/types";

export const dynamic = "force-dynamic";

function toView(p: {
  id: string;
  coinId: string;
  symbol: string;
  side: string;
  leverage: number;
  marginUsd: number;
  entryPrice: number;
  quantity: number;
  status: string;
  closePrice: number | null;
  pnlUsd: number | null;
  openedAt: Date;
  closedAt: Date | null;
}, coinMeta: Map<string, { name: string; image: string }>): PositionView {
  const meta = coinMeta.get(p.coinId);
  return {
    id: p.id,
    coinId: p.coinId,
    symbol: p.symbol,
    name: meta?.name ?? p.symbol,
    image: meta?.image ?? "",
    side: p.side === "SHORT" ? "SHORT" : "LONG",
    leverage: p.leverage,
    marginUsd: p.marginUsd,
    entryPrice: p.entryPrice,
    quantity: p.quantity,
    status: p.status === "CLOSED" ? "CLOSED" : "OPEN",
    closePrice: p.closePrice,
    pnlUsd: p.pnlUsd,
    openedAt: p.openedAt.toISOString(),
    closedAt: p.closedAt?.toISOString() ?? null,
  };
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId wajib diisi." }, { status: 400 });
  }
  try {
    const rows = await db.position.findMany({
      where: { userId },
      orderBy: [{ status: "desc" }, { openedAt: "desc" }],
    });
    const { coins } = await getMarket();
    const coinMeta = new Map(coins.map((c) => [c.id, { name: c.name, image: c.image }]));

    const all = rows.map((r) => toView(r, coinMeta));
    const open = all.filter((p) => p.status === "OPEN");
    const closed = all.filter((p) => p.status === "CLOSED");
    const realizedPnlUsd = closed.reduce((acc, p) => acc + (p.pnlUsd ?? 0), 0);

    return NextResponse.json({ open, closed, realizedPnlUsd });
  } catch (err) {
    console.error("positions GET error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: {
    userId?: string;
    coinId?: string;
    symbol?: string;
    side?: string;
    leverage?: number;
    marginUsd?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
  }

  const { userId, coinId } = body;
  const side = body.side === "SHORT" ? "SHORT" : "LONG";
  const leverage = Math.min(Math.max(Number(body.leverage) || 1, 1), 20);
  const marginUsd = Number(body.marginUsd);

  if (!userId || !coinId) {
    return NextResponse.json({ error: "userId dan coinId wajib diisi." }, { status: 400 });
  }
  if (!Number.isFinite(marginUsd) || marginUsd < 10) {
    return NextResponse.json({ error: "Margin minimal $10." }, { status: 400 });
  }

  try {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });

    const info = await getCoinPrice(coinId);
    if (!info || !(info.price > 0)) {
      return NextResponse.json({ error: "Harga tidak tersedia." }, { status: 400 });
    }

    // Margin hanya boleh dari saldo aktif (wajib ada deposit disetujui admin).
    const effective = await effectiveCashUsd(userId, user.cashUsd);
    if (effective < marginUsd) {
      return NextResponse.json(
        { error: "Saldo tidak cukup untuk margin. Ajukan Isi Dana dan tunggu ACC admin terlebih dahulu." },
        { status: 400 }
      );
    }

    const entryPrice = info.price;
    const quantity = (marginUsd * leverage) / entryPrice;

    const [, position, updated] = await db.$transaction([
      db.user.update({ where: { id: userId }, data: { cashUsd: { decrement: marginUsd } } }),
      db.position.create({
        data: { userId, coinId, symbol: body.symbol || info.symbol, side, leverage, marginUsd, entryPrice, quantity },
      }),
      db.transaction.create({
        data: {
          userId,
          type: "CONTRACT_OPEN",
          amountUsd: -marginUsd,
          note: `Buka ${side} ${body.symbol || info.symbol} ${leverage}x`,
        },
      }),
      db.user.findUnique({ where: { id: userId } }),
    ]);

    return NextResponse.json({
      id: position.id,
      cashUsd: updated?.cashUsd ?? user.cashUsd - marginUsd,
    });
  } catch (err) {
    console.error("positions POST error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}
