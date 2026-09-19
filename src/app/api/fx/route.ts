import { NextResponse } from "next/server";
import { getUsdIdrRate } from "@/lib/market-data";

export const dynamic = "force-dynamic";

/**
 * GET /api/fx — kurs USD→IDR terkini (cache 10 menit di server).
 * Dipakai dialog Isi Dana / Tarik Dana untuk pratinjau konversi Rupiah → USDT.
 */
export async function GET() {
  try {
    const rate = await getUsdIdrRate();
    return NextResponse.json({ rate });
  } catch (err) {
    console.error("fx error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}
