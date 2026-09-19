import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCoinPrice } from "@/lib/market-data";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { positionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
  }

  const positionId = body.positionId;
  if (!positionId) {
    return NextResponse.json({ error: "positionId wajib diisi." }, { status: 400 });
  }

  try {
    const position = await db.position.findUnique({ where: { id: positionId } });
    if (!position) {
      return NextResponse.json({ error: "Posisi tidak ditemukan." }, { status: 404 });
    }
    if (position.status !== "OPEN") {
      return NextResponse.json({ error: "Posisi sudah ditutup." }, { status: 400 });
    }

    const info = await getCoinPrice(position.coinId);
    const closePrice = info?.price ?? position.entryPrice;

    const dir = position.side === "LONG" ? 1 : -1;
    const pnl = position.quantity * (closePrice - position.entryPrice) * dir;

    // return margin + realized PnL (PnL can be negative)
    const returned = position.marginUsd + pnl;

    const [, , , updated] = await db.$transaction([
      db.position.update({
        where: { id: positionId },
        data: { status: "CLOSED", closePrice, pnlUsd: pnl, closedAt: new Date() },
      }),
      db.user.update({
        where: { id: position.userId },
        data: { cashUsd: { increment: returned } },
      }),
      db.transaction.create({
        data: {
          userId: position.userId,
          type: "CONTRACT_CLOSE",
          amountUsd: returned,
          note: `Tutup ${position.side} ${position.symbol} · PnL ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}`,
        },
      }),
      db.user.findUnique({ where: { id: position.userId } }),
    ]);

    return NextResponse.json({
      pnlUsd: pnl,
      closePrice,
      cashUsd: updated?.cashUsd,
    });
  } catch (err) {
    console.error("positions close error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}
