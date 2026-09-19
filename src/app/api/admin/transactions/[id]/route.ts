import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import type { AdminWalletTxRow, TxStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/transactions/[id] — { action: "APPROVE" | "REJECT", note? }
 * Setujui: saldo pengguna baru berubah di titik ini
 *   - DEPOSIT  → cashUsd += jumlah
 *   - WITHDRAW → cashUsd -= jumlah (dicek ulang; ditolak otomatis bila saldo tak cukup)
 * Tolak: tidak ada perubahan saldo, wajib menyertakan alasan.
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  }

  let body: { action?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
  }

  const action = body.action === "APPROVE" ? "APPROVE" : body.action === "REJECT" ? "REJECT" : null;
  if (!action) {
    return NextResponse.json({ error: "Aksi tidak valid." }, { status: 400 });
  }

  const note = (body.note ?? "").trim();
  if (action === "REJECT" && note.length < 3) {
    return NextResponse.json({ error: "Alasan penolakan wajib diisi (min. 3 karakter)." }, { status: 400 });
  }
  if (note.length > 300) {
    return NextResponse.json({ error: "Catatan maksimal 300 karakter." }, { status: 400 });
  }

  const { id } = await ctx.params;
  try {
    const tx = await db.transaction.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, email: true, cashUsd: true } } },
    });
    if (!tx) {
      return NextResponse.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });
    }
    if (tx.type !== "DEPOSIT" && tx.type !== "WITHDRAW") {
      return NextResponse.json({ error: "Transaksi ini bukan pengajuan dana." }, { status: 400 });
    }
    if (tx.status !== "PENDING") {
      return NextResponse.json({ error: "Pengajuan ini sudah ditinjau sebelumnya." }, { status: 409 });
    }

    const amount = Math.abs(tx.amountUsd);

    if (action === "APPROVE") {
      if (tx.type === "DEPOSIT") {
        // Setujui isi dana: kredit saldo pengguna secara atomik
        const updated = await db.$transaction(async (txdb) => {
          const row = await txdb.user.update({
            where: { id: tx.userId },
            data: { cashUsd: { increment: amount } },
          });
          const t = await txdb.transaction.update({
            where: { id },
            data: {
              status: "APPROVED",
              reviewNote: note || null,
              reviewedAt: new Date(),
              note: "Isi dana disetujui admin",
            },
          });
          return { user: row, tx: t };
        });

        return NextResponse.json({
          transaction: mapRow(updated.tx, updated.user.name, updated.user.email, updated.user.cashUsd),
        });
      }

      // WITHDRAW: cek & debit saldo secara atomik (guard saldo di where clause)
      const debit = await db.user.updateMany({
        where: { id: tx.userId, cashUsd: { gte: amount } },
        data: { cashUsd: { decrement: amount } },
      });
      if (debit.count === 0) {
        // Saldo pengguna sudah tidak cukup — tolak otomatis dengan alasan.
        const rejected = await db.transaction.update({
          where: { id },
          data: {
            status: "REJECTED",
            reviewNote: "Ditolak otomatis: saldo pengguna tidak mencukupi saat persetujuan.",
            reviewedAt: new Date(),
          },
        });
        return NextResponse.json(
          {
            transaction: mapRow(rejected, tx.user.name, tx.user.email, tx.user.cashUsd),
            autoRejected: true,
          },
          { status: 409 }
        );
      }
      const t = await db.transaction.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewNote: note || null,
          reviewedAt: new Date(),
          note: "Tarik dana disetujui admin",
        },
      });
      const user = await db.user.findUniqueOrThrow({
        where: { id: tx.userId },
        select: { name: true, email: true, cashUsd: true },
      });
      return NextResponse.json({
        transaction: mapRow(t, user.name, user.email, user.cashUsd),
      });
    }

    // REJECT — tanpa perubahan saldo
    const t = await db.transaction.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewNote: note,
        reviewedAt: new Date(),
      },
    });
    return NextResponse.json({
      transaction: mapRow(t, tx.user.name, tx.user.email, tx.user.cashUsd),
    });
  } catch (err) {
    console.error("admin transactions review error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}

function mapRow(
  t: { id: string; type: string; amountUsd: number; amountIdr: number | null; status: string; note: string | null; reviewNote: string | null; createdAt: Date; reviewedAt: Date | null; userId: string },
  userName: string | null,
  userEmail: string,
  userCashUsd: number
): AdminWalletTxRow {
  return {
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
    userName: userName ?? "",
    userEmail,
    userCashUsd,
  };
}
