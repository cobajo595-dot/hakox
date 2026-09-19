import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCoinPrice, getUsdIdrRate } from "@/lib/market-data";
import { effectiveCashUsd } from "@/lib/balance";
import {
  MIN_BINARY_BET_USD,
  isValidExpiry,
  mapOrder,
  profitPctFor,
  settleDueBinaryOrders,
} from "@/lib/binary";

export const dynamic = "force-dynamic";

/** GET /api/binary?userId=...&limit=30 — settle yang kedaluwarsa lalu kirim daftar order opsi user. */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")?.trim() ?? "";
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 30, 100);
  if (!userId) {
    return NextResponse.json({ error: "userId wajib." }, { status: 400 });
  }

  try {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
    }

    await settleDueBinaryOrders();

    const rows = await db.binaryOrder.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Harga live untuk setiap koin yang muncul di daftar (sheet detail butuh
    // "harga saat ini" untuk order yang mungkin bukan koin terpilih).
    const prices: Record<string, number> = {};
    for (const coinId of [...new Set(rows.map((r) => r.coinId))]) {
      const c = await getCoinPrice(coinId);
      if (c) prices[coinId] = c.price;
    }

    return NextResponse.json({
      orders: rows.map(mapOrder),
      cashUsd: (await db.user.findUnique({ where: { id: userId } }))?.cashUsd ?? user.cashUsd,
      usdIdrRate: await getUsdIdrRate(),
      prices,
    });
  } catch (err) {
    console.error("binary list error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}

/** POST /api/binary — buat order opsi naik/turun baru. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      userId?: string;
      coinId?: string;
      symbol?: string;
      direction?: string;
      amountUsd?: number;
      expiryMin?: number;
    };

    const userId = body.userId?.trim() ?? "";
    const coinId = body.coinId?.trim() ?? "";
    const direction = body.direction?.trim().toUpperCase() ?? "";
    const amountUsd = Number(body.amountUsd);
    const expiryMin = Number(body.expiryMin);

    if (!userId || !coinId) {
      return NextResponse.json({ error: "Data tidak lengkap." }, { status: 400 });
    }
    if (direction !== "UP" && direction !== "DOWN") {
      return NextResponse.json({ error: "Arah tidak valid." }, { status: 400 });
    }
    if (!Number.isFinite(amountUsd) || amountUsd < MIN_BINARY_BET_USD) {
      return NextResponse.json(
        { error: `Jumlah pembelian minimum adalah ${MIN_BINARY_BET_USD.toFixed(2)} USDT.` },
        { status: 400 }
      );
    }
    if (!isValidExpiry(expiryMin)) {
      return NextResponse.json({ error: "Waktu kedaluwarsa tidak valid." }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
    }
    // Order opsi hanya boleh dari saldo aktif (wajib ada deposit disetujui admin).
    const effectiveCash = await effectiveCashUsd(userId, user.cashUsd);
    if (effectiveCash < amountUsd) {
      return NextResponse.json(
        { error: "Saldo tidak cukup. Ajukan Isi Dana dan tunggu ACC admin terlebih dahulu." },
        { status: 400 }
      );
    }

    const coin = await getCoinPrice(coinId);
    if (!coin) {
      return NextResponse.json({ error: "Harga pasar tidak tersedia." }, { status: 400 });
    }

    const profitPct = profitPctFor(expiryMin);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiryMin * 60_000);
    const symbol = (body.symbol?.trim() || coin.symbol).toUpperCase();

    const result = await db.$transaction(async (tx) => {
      // Klaim saldo secara atomik (guard saldo cukup).
      const claimed = await tx.user.updateMany({
        where: { id: userId, cashUsd: { gte: amountUsd } },
        data: { cashUsd: { decrement: amountUsd } },
      });
      if (claimed.count === 0) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      const order = await tx.binaryOrder.create({
        data: {
          userId,
          coinId,
          symbol,
          direction,
          amountUsd,
          profitPct,
          entryPrice: coin.price,
          expiryMin,
          expiresAt,
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: "BINARY_OPEN",
          amountUsd: -amountUsd,
          note: `Opsi ${direction === "UP" ? "Naik" : "Turun"} ${symbol}/USDT ${expiryMin} menit @ ${coin.price}`,
          status: "COMPLETED",
        },
      });

      const fresh = await tx.user.findUnique({ where: { id: userId } });
      return { order, cashUsd: fresh?.cashUsd ?? user.cashUsd - amountUsd };
    });

    return NextResponse.json({
      order: mapOrder(result.order),
      cashUsd: result.cashUsd,
      usdIdrRate: await getUsdIdrRate(),
    });
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_BALANCE") {
      return NextResponse.json({ error: "Saldo tidak cukup." }, { status: 400 });
    }
    console.error("binary create error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}
