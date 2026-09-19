import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { mapKyc } from "@/lib/kyc";
import type { AdminKycRow } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/admin/kyc?status=PENDING&q=keyword — daftar semua pengajuan KYC (tanpa foto). */
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get("status")?.trim().toUpperCase() ?? "";
  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";

  try {
    const rows = await db.kyc.findMany({
      where: ["PENDING", "APPROVED", "REJECTED"].includes(status)
        ? { status }
        : undefined,
      orderBy: { submittedAt: "desc" },
      take: 200,
      include: { user: { select: { name: true, email: true } } },
    });

    const mapped: AdminKycRow[] = rows
      .map((k) => ({
        ...mapKyc(k),
        userId: k.userId,
        userName: k.user.name ?? "",
        userEmail: k.user.email,
      }))
      .filter(
        (r) =>
          q === "" ||
          r.userEmail.toLowerCase().includes(q) ||
          r.userName.toLowerCase().includes(q) ||
          r.fullName.toLowerCase().includes(q) ||
          r.idNumber.toLowerCase().includes(q)
      );

    const counts = {
      total: await db.kyc.count(),
      pending: await db.kyc.count({ where: { status: "PENDING" } }),
      approved: await db.kyc.count({ where: { status: "APPROVED" } }),
      rejected: await db.kyc.count({ where: { status: "REJECTED" } }),
    };

    return NextResponse.json({ rows: mapped, counts });
  } catch (err) {
    console.error("admin kyc list error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}
