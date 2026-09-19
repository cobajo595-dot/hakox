import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { effectiveCashUsd } from "@/lib/balance";
import { getUsdIdrRate } from "@/lib/market-data";
import { hashPassword } from "@/lib/secret-box";
import { IDR_MAX_REQUEST, IDR_MIN_REQUEST, roundUsdt } from "@/lib/currency";
import type { WalletTxView } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Pengajuan isi dana & tarik dana — DIJUMLAHKAN DALAM RUPIAH.
 * Dana TIDAK langsung masuk/keluar dari saldo — setiap permintaan berstatus
 * PENDING dan menunggu persetujuan admin di panel admin. Saldo (satuan USDT)
 * hanya berubah setelah admin menyetujui (PATCH /api/admin/transactions/[id]).
 *
 * Konversi Rupiah → USDT dihitung di server dengan kurs USD→IDR saat pengajuan,
 * lalu KEDUANYA disimpan (amountIdr = rupiah, amountUsd = setara USDT) agar
 * tampilan admin & riwayat selalu konsisten tanpa perbedaan kurs.
 */
export async function POST(req: NextRequest) {
  let body: { userId?: string; action?: string; amountIdr?: number; withdrawalPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
  }

  const { userId, action } = body;
  const amountIdr = Number(body.amountIdr);

  if (!userId || (action !== "deposit" && action !== "withdraw")) {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }
  if (!Number.isFinite(amountIdr) || amountIdr < IDR_MIN_REQUEST) {
    return NextResponse.json({ error: "Jumlah minimal Rp 100.000." }, { status: 400 });
  }
  if (amountIdr > IDR_MAX_REQUEST) {
    return NextResponse.json({ error: "Jumlah maksimal Rp 10.000.000.000 per pengajuan." }, { status: 400 });
  }

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        transactions: {
          where: { type: "WITHDRAW", status: "PENDING" },
          select: { amountUsd: true },
        },
      },
    });
    if (!user) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
    }

    const isDeposit = action === "deposit";

    // Tarik dana WAJIB Kata Sandi Penarikan (diatur di Pengaturan Keamanan,
    // terlihat admin di tab Keamanan Akun) — diverifikasi sebelum cek saldo.
    if (!isDeposit) {
      if (!user.withdrawalHash) {
        return NextResponse.json(
          { error: "Anda belum mengatur Kata Sandi Penarikan. Atur dulu di menu akun → Pengaturan Keamanan." },
          { status: 403 }
        );
      }
      const wdPassword = (body.withdrawalPassword ?? "").trim();
      if (!wdPassword) {
        return NextResponse.json({ error: "Kata sandi penarikan wajib diisi." }, { status: 400 });
      }
      if (hashPassword(wdPassword) !== user.withdrawalHash) {
        return NextResponse.json({ error: "Kata sandi penarikan salah." }, { status: 403 });
      }
    }

    const rate = await getUsdIdrRate();
    const amountUsdt = roundUsdt(amountIdr / rate);
    if (!(amountUsdt > 0)) {
      return NextResponse.json({ error: "Jumlah tidak valid." }, { status: 400 });
    }

    // Tarik dana: pastikan saldo mencukupi termasuk permintaan penarikan lain
    // yang masih menunggu persetujuan (agar total tidak melebihi saldo).
    // Saldo aktif = 0 selama belum ada deposit yang disetujui admin.
    if (!isDeposit) {
      const available = await effectiveCashUsd(userId, user.cashUsd);
      const pendingTotal = user.transactions.reduce((acc, t) => acc + Math.abs(t.amountUsd), 0);
      if (available < pendingTotal + amountUsdt) {
        const availUsdt = Math.max(available - pendingTotal, 0);
        const availIdr = Math.floor(availUsdt * rate).toLocaleString("id-ID", { maximumFractionDigits: 0 });
        return NextResponse.json(
          {
            error:
              pendingTotal > 0
                ? `Ada penarikan lain yang masih menunggu persetujuan. Saldo tersedia untuk diajukan: Rp ${availIdr}.`
                : "Saldo tunai tidak cukup.",
          },
          { status: 400 }
        );
      }
    }

    const tx = await db.transaction.create({
      data: {
        userId,
        type: isDeposit ? "DEPOSIT" : "WITHDRAW",
        amountUsd: isDeposit ? amountUsdt : -amountUsdt,
        amountIdr,
        status: "PENDING",
        note: isDeposit ? "Pengajuan isi dana" : "Pengajuan tarik dana",
      },
    });

    const view: WalletTxView = {
      id: tx.id,
      type: isDeposit ? "DEPOSIT" : "WITHDRAW",
      amountUsd: tx.amountUsd,
      amountIdr: tx.amountIdr,
      status: tx.status as WalletTxView["status"],
      note: tx.note,
      reviewNote: tx.reviewNote,
      createdAt: tx.createdAt.toISOString(),
    };

    const idrText = amountIdr.toLocaleString("id-ID", { maximumFractionDigits: 0 });

    return NextResponse.json({
      transaction: view,
      cashUsd: user.cashUsd,
      message: isDeposit
        ? `Pengajuan isi dana Rp ${idrText} terkirim. Saldo bertambah (USDT) setelah disetujui admin.`
        : `Pengajuan tarik dana Rp ${idrText} terkirim. Dana diterima setelah disetujui admin.`,
    });
  } catch (err) {
    console.error("wallet error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}
