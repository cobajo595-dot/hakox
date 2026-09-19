import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Endpoint publik: daftar pengumuman aktif untuk ticker di beranda. */
export async function GET() {
  try {
    const rows = await db.notice.findMany({
      where: { active: true },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, content: true },
    });
    return NextResponse.json({ notices: rows });
  } catch (err) {
    console.error("notices GET error", err);
    return NextResponse.json({ notices: [] });
  }
}
