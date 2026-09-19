import { db } from "@/lib/db";

/**
 * Aturan dana HakoX: saldo HANYA tampil dan bisa dipakai setelah pengguna
 * memiliki minimal satu pengajuan Isi Dana (DEPOSIT) yang disetujui admin.
 * Selama belum ada deposit yang disetujui, saldo efektif selalu 0 —
 * termasuk sisa saldo lama/bonus yang tidak pernah melalui persetujuan admin.
 */

/** True jika pengguna punya minimal satu deposit berstatus APPROVED (ACC admin). */
export async function hasApprovedDeposit(userId: string): Promise<boolean> {
  const n = await db.transaction.count({
    where: { userId, type: "DEPOSIT", status: "APPROVED" },
  });
  return n > 0;
}

/**
 * Saldo efektif yang boleh ditampilkan dan dipakai untuk trading/penarikan.
 * Selama belum ada deposit yang disetujui admin → selalu 0.
 */
export async function effectiveCashUsd(userId: string, rawCashUsd: number): Promise<number> {
  if (rawCashUsd <= 0) return rawCashUsd;
  return (await hasApprovedDeposit(userId)) ? rawCashUsd : 0;
}
