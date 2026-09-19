import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { getMarket } from "@/lib/market-data";
import type { AdminTxRow, AdminUserDetail, TradeView } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  }

  const { id } = await ctx.params;

  try {
    const user = await db.user.findUnique({
      where: { id },
      include: {
        holdings: true,
        trades: { orderBy: { createdAt: "desc" }, take: 25 },
        positions: { orderBy: { openedAt: "desc" }, take: 25 },
        transactions: { orderBy: { createdAt: "desc" }, take: 25 },
      },
    });
    if (!user) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
    }

    const { coins } = await getMarket();
    const priceMap = new Map(coins.map((c) => [c.id, c.price]));

    const detail: AdminUserDetail = {
      id: user.id,
      email: user.email,
      name: user.name ?? "",
      cashUsd: user.cashUsd,
      createdAt: user.createdAt.toISOString(),
      holdings: user.holdings.map((h) => {
        const price = priceMap.get(h.coinId) ?? 0;
        return {
          coinId: h.coinId,
          symbol: h.symbol,
          amount: h.amount,
          price,
          valueUsd: h.amount * price,
        };
      }),
      openPositions: user.positions
        .filter((p) => p.status === "OPEN")
        .map((p) => {
          const priceNow = priceMap.get(p.coinId) ?? p.entryPrice;
          const dir = p.side === "LONG" ? 1 : -1;
          return {
            id: p.id,
            symbol: p.symbol,
            side: p.side,
            leverage: p.leverage,
            marginUsd: p.marginUsd,
            entryPrice: p.entryPrice,
            priceNow,
            pnlUsd: p.quantity * (priceNow - p.entryPrice) * dir,
          };
        }),
      trades: user.trades.map<TradeView>((t) => ({
        id: t.id,
        coinId: t.coinId,
        symbol: t.symbol,
        side: t.side === "SELL" ? "SELL" : "BUY",
        quantity: t.quantity,
        price: t.price,
        totalUsd: t.totalUsd,
        createdAt: t.createdAt.toISOString(),
      })),
      transactions: user.transactions.map<AdminTxRow>((t) => ({
        id: t.id,
        type: (t.type as AdminTxRow["type"]) ?? "ADMIN_ADJUST",
        amountUsd: t.amountUsd,
        note: t.note,
        createdAt: t.createdAt.toISOString(),
        userName: user.name ?? user.email,
        userEmail: user.email,
      })),
    };

    return NextResponse.json(detail);
  } catch (err) {
    console.error("admin user detail error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}
