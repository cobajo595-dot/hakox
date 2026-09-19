import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCoinPrice } from "@/lib/market-data";
import { effectiveCashUsd } from "@/lib/balance";
import type { TradeView } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 20) || 20, 50);
  if (!userId) {
    return NextResponse.json({ error: "userId wajib diisi." }, { status: 400 });
  }
  try {
    const rows = await db.trade.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    const trades: TradeView[] = rows.map((t) => ({
      id: t.id,
      coinId: t.coinId,
      symbol: t.symbol,
      side: t.side === "SELL" ? "SELL" : "BUY",
      quantity: t.quantity,
      price: t.price,
      totalUsd: t.totalUsd,
      createdAt: t.createdAt.toISOString(),
    }));
    return NextResponse.json({ trades });
  } catch (err) {
    console.error("trades GET error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: {
    userId?: string;
    coinId?: string;
    symbol?: string;
    side?: string;
    usdAmount?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
  }

  const { userId, coinId } = body;
  const side = body.side === "SELL" ? "SELL" : "BUY";
  const usdAmount = Number(body.usdAmount);

  if (!userId || !coinId) {
    return NextResponse.json({ error: "userId dan coinId wajib diisi." }, { status: 400 });
  }
  if (!Number.isFinite(usdAmount) || usdAmount <= 0) {
    return NextResponse.json({ error: "Jumlah harus lebih dari 0." }, { status: 400 });
  }
  if (usdAmount < 1) {
    return NextResponse.json({ error: "Order minimum $1." }, { status: 400 });
  }

  try {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });

    // Beli hanya boleh dari saldo yang sudah aktif (wajib ada deposit disetujui admin).
    if (side === "BUY") {
      const effective = await effectiveCashUsd(userId, user.cashUsd);
      if (effective < usdAmount + 1e-9) {
        return NextResponse.json(
          { error: "Saldo tidak cukup. Ajukan Isi Dana dan tunggu ACC admin terlebih dahulu." },
          { status: 400 }
        );
      }
    }

    const info = await getCoinPrice(coinId);
    if (!info || !(info.price > 0)) {
      return NextResponse.json({ error: "Harga koin tidak tersedia saat ini." }, { status: 400 });
    }
    const symbol = body.symbol || info.symbol;
    const price = info.price;
    const quantity = usdAmount / price;

    const result = await db.$transaction(async (tx) => {
      const fresh = await tx.user.findUnique({ where: { id: userId } });
      if (!fresh) throw new Error("USER_NOT_FOUND");

      let holding = await tx.holding.findUnique({
        where: { userId_coinId: { userId, coinId } },
      });

      if (side === "BUY") {
        if (fresh.cashUsd < usdAmount + 1e-9) {
          throw new Error("INSUFFICIENT_CASH");
        }
        holding = await tx.holding.upsert({
          where: { userId_coinId: { userId, coinId } },
          create: { userId, coinId, symbol, amount: quantity },
          update: { amount: { increment: quantity }, symbol },
        });
        await tx.user.update({
          where: { id: userId },
          data: { cashUsd: { decrement: usdAmount } },
        });
      } else {
        if (!holding || holding.amount < quantity - 1e-12) {
          throw new Error("INSUFFICIENT_HOLDING");
        }
        const remaining = holding.amount - quantity;
        await tx.holding.update({
          where: { id: holding.id },
          data: { amount: Math.max(remaining, 0) },
        });
        await tx.user.update({
          where: { id: userId },
          data: { cashUsd: { increment: usdAmount } },
        });
      }

      const trade = await tx.trade.create({
        data: { userId, coinId, symbol, side, quantity, price, totalUsd: usdAmount },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: side === "BUY" ? "TRADE_BUY" : "TRADE_SELL",
          amountUsd: side === "BUY" ? -usdAmount : usdAmount,
          note: `${side === "BUY" ? "Beli" : "Jual"} ${symbol} @ ${price}`,
        },
      });

      const updated = await tx.user.findUnique({ where: { id: userId } });

      return {
        trade,
        quantity,
        price,
        cashUsd: updated?.cashUsd ?? fresh.cashUsd,
        holdingAmount: side === "BUY" ? holding.amount + (0) : (holding?.amount ?? 0) - quantity,
      };
    });

    return NextResponse.json({
      id: result.trade.id,
      quantity: result.quantity,
      price: result.price,
      cashUsd: result.cashUsd,
      holdingAmount: result.holdingAmount,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "INSUFFICIENT_CASH") {
      return NextResponse.json({ error: "Saldo USD tidak cukup." }, { status: 400 });
    }
    if (msg === "INSUFFICIENT_HOLDING") {
      return NextResponse.json({ error: "Saldo koin tidak cukup untuk dijual." }, { status: 400 });
    }
    console.error("trade POST error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}
