import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import type { AdminWalletTxRow, TxStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/admin/transactions — daftar pengajuan isi dana & tarik dana (?status=&type=). */
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  }

  const statusParam = req.nextUrl.searchParams.get("status") ?? "ALL";
  const typeParam = req.nextUrl.searchParams.get("type") ?? "ALL";

  const where: {
    type: { in: string[] };
    status?: string;
  } = {
    type:
      typeParam === "DEPOSIT" || typeParam === "WITHDRAW"
        ? { in: [typeParam] }
        : { in: ["DEPOSIT", "WITHDRAW"] },
  };
  if (["PENDING", "APPROVED", "REJECTED", "COMPLETED"].includes(statusParam)) {
    where.status = statusParam;
  }

  try {
    const [rows, countAll, countPending, countApproved, countRejected] = await Promise.all([
      db.transaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 150,
        include: { user: { select: { id: true, name: true, email: true, cashUsd: true } } },
      }),
      db.transaction.count({ where: { type: { in: ["DEPOSIT", "WITHDRAW"] } } }),
      db.transaction.count({ where: { type: { in: ["DEPOSIT", "WITHDRAW"] }, status: "PENDING" } }),
      db.transaction.count({ where: { type: { in: ["DEPOSIT", "WITHDRAW"] }, status: "APPROVED" } }),
      db.transaction.count({ where: { type: { in: ["DEPOSIT", "WITHDRAW"] }, status: "REJECTED" } }),
    ]);

    const mapped: AdminWalletTxRow[] = rows.map((t) => ({
      id: t.id,
      type: t.type as AdminWalletTxRow["type"],
      amountUsd: t.amountUsd,
      amountIdr: t.amountIdr,
      status: t.status as TxStatus,
      note: t.note,
      reviewNote: t.reviewNote,
      createdAt: t.createdAt.toISOString(),
      reviewedAt: t.reviewedAt ? t.reviewedAt.toISOString() : null,
      userId: t.userId,
      userName: t.user.name ?? "",
      userEmail: t.user.email,
      userCashUsd: t.user.cashUsd,
    }));

    return NextResponse.json({
      rows: mapped,
      counts: { total: countAll, pending: countPending, approved: countApproved, rejected: countRejected },
    });
  } catch (err) {
    console.error("admin transactions error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}
