import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMarket, getUsdIdrRate } from "@/lib/market-data";
import { hasApprovedDeposit } from "@/lib/balance";
import type { AssetsResponse, HoldingView, WalletTxView } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId wajib diisi." }, { status: 400 });
  }

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { holdings: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
    }

    // Aturan dana: selama belum ada deposit yang disetujui admin, SEMUA aset
    // (saldo tunai + koin) tampil 0 — akun "terkunci" sampai deposit pertama di-ACC.
    const unlocked = await hasApprovedDeposit(user.id);
    const cash = unlocked ? user.cashUsd : 0;

    const { coins } = await getMarket();
    const coinMap = new Map(coins.map((c) => [c.id, c]));

    const holdings: HoldingView[] = user.holdings
      .filter((h) => unlocked && h.amount > 1e-12)
      .map((h) => {
        const c = coinMap.get(h.coinId);
        const price = c?.price ?? 0;
        return {
          coinId: h.coinId,
          symbol: h.symbol,
          name: c?.name ?? h.symbol,
          image: c?.image ?? "",
          amount: h.amount,
          price,
          valueUsd: h.amount * price,
          change24h: c?.change24h ?? 0,
        };
      })
      .sort((a, b) => b.valueUsd - a.valueUsd);

    const holdingsUsd = holdings.reduce((acc, h) => acc + h.valueUsd, 0);

    const openPositions = await db.position.findMany({
      where: { userId, status: "OPEN" },
    });
    const openMarginUsd = openPositions.reduce((acc, p) => acc + p.marginUsd, 0);

    // unrealized PnL at current prices
    let openPnlUsd = 0;
    for (const p of openPositions) {
      const price = coinMap.get(p.coinId)?.price ?? p.entryPrice;
      const dir = p.side === "LONG" ? 1 : -1;
      openPnlUsd += p.quantity * (price - p.entryPrice) * dir;
    }

    const usdIdrRate = await getUsdIdrRate();

    // Riwayat pengajuan dana (isi/tarik) + status persetujuan admin
    const txRows = await db.transaction.findMany({
      where: { userId, type: { in: ["DEPOSIT", "WITHDRAW"] } },
      orderBy: { createdAt: "desc" },
      take: 25,
    });
    const transactions: WalletTxView[] = txRows.map((t) => ({
      id: t.id,
      type: t.type as WalletTxView["type"],
      amountUsd: t.amountUsd,
      amountIdr: t.amountIdr,
      status: t.status as WalletTxView["status"],
      note: t.note,
      reviewNote: t.reviewNote,
      createdAt: t.createdAt.toISOString(),
    }));

    const payload: AssetsResponse = {
      cashUsd: cash,
      holdings,
      holdingsUsd,
      openMarginUsd,
      openPnlUsd,
      totalUsd: cash + holdingsUsd,
      usdIdrRate,
      transactions,
    };
    return NextResponse.json(payload);
  } catch (err) {
    console.error("assets error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}
