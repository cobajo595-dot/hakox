import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import type { AdminBankCardRow } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/bank-cards — semua kartu bank / e-wallet pengguna
 * (nama pemilik rekening + nomor rekening terlihat oleh admin).
 */
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";

  try {
    const rows = await db.bankCard.findMany({
      where: q
        ? {
            OR: [
              { holderName: { contains: q } },
              { bankName: { contains: q } },
              { accountNumber: { contains: q } },
              { phone: { contains: q } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: 300,
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    const mapped: AdminBankCardRow[] = rows.map((c) => ({
      id: c.id,
      userId: c.userId,
      holderName: c.holderName,
      bankName: c.bankName,
      accountNumber: c.accountNumber,
      phone: c.phone,
      createdAt: c.createdAt.toISOString(),
      userName: c.user.name ?? "",
      userEmail: c.user.email,
    }));

    const distinctUsers = await db.bankCard.groupBy({ by: ["userId"] });

    return NextResponse.json({
      rows: mapped,
      counts: { total: mapped.length, users: distinctUsers.length },
    });
  } catch (err) {
    console.error("admin bank-cards error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}
