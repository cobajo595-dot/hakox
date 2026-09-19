import { NextResponse } from "next/server";
import { getMarket } from "@/lib/market-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getMarket();
  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
