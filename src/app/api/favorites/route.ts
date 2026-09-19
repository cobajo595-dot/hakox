import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId wajib diisi." }, { status: 400 });
  }
  try {
    const rows = await db.favorite.findMany({ where: { userId } });
    return NextResponse.json({ coinIds: rows.map((r) => r.coinId) });
  } catch (err) {
    console.error("favorites GET error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { userId?: string; coinId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
  }
  const { userId, coinId } = body;
  if (!userId || !coinId) {
    return NextResponse.json({ error: "userId dan coinId wajib diisi." }, { status: 400 });
  }
  try {
    const existing = await db.favorite.findUnique({
      where: { userId_coinId: { userId, coinId } },
    });
    if (existing) {
      await db.favorite.delete({ where: { id: existing.id } });
      return NextResponse.json({ favorited: false });
    }
    await db.favorite.create({ data: { userId, coinId } });
    return NextResponse.json({ favorited: true });
  } catch (err) {
    console.error("favorites POST error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}
