import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ALL_BANK_OPTIONS, isEwallet } from "@/lib/banks";

export const dynamic = "force-dynamic";

const MAX_CARDS_PER_USER = 5;

/** GET /api/bank-cards?userId=... — daftar kartu bank / e-wallet milik pengguna. */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")?.trim() ?? "";
  if (!userId) {
    return NextResponse.json({ error: "userId wajib." }, { status: 400 });
  }

  try {
    const rows = await db.bankCard.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({
      cards: rows.map((c) => ({
        id: c.id,
        holderName: c.holderName,
        bankName: c.bankName,
        accountNumber: c.accountNumber,
        phone: c.phone,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("bank-cards list error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}

/** POST /api/bank-cards — tambah kartu bank / e-wallet baru. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      userId?: string;
      holderName?: string;
      bankName?: string;
      accountNumber?: string;
      phone?: string;
    };

    const userId = body.userId?.trim() ?? "";
    const holderName = body.holderName?.trim() ?? "";
    const bankName = body.bankName?.trim() ?? "";
    const accountNumber = (body.accountNumber ?? "").replace(/[\s-]/g, "");
    const phone = (body.phone ?? "").replace(/[\s\-().]/g, "").replace(/^\+/, "");

    if (!userId || !holderName || !bankName || !accountNumber || !phone) {
      return NextResponse.json(
        { error: "Semua data kartu wajib diisi (pemilik, bank, nomor rekening, telepon)." },
        { status: 400 }
      );
    }
    if (!ALL_BANK_OPTIONS.includes(bankName)) {
      return NextResponse.json({ error: "Nama bank / e-wallet tidak valid." }, { status: 400 });
    }
    if (holderName.length < 2 || holderName.length > 40) {
      return NextResponse.json({ error: "Nama pemilik rekening harus 2-40 karakter." }, { status: 400 });
    }
    if (!/^\d{6,20}$/.test(accountNumber)) {
      return NextResponse.json(
        { error: "Nomor rekening harus 6-20 angka tanpa huruf." },
        { status: 400 }
      );
    }
    if (!/^0\d{8,14}$|^62\d{8,13}$|^8\d{8,13}$/.test(phone)) {
      return NextResponse.json(
        { error: "Nomor telepon tidak valid (contoh: 081234567890)." },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
    }

    const count = await db.bankCard.count({ where: { userId } });
    if (count >= MAX_CARDS_PER_USER) {
      return NextResponse.json(
        { error: `Maksimal ${MAX_CARDS_PER_USER} kartu bank per akun.` },
        { status: 400 }
      );
    }

    // Satu kombinasi bank + nomor rekening hanya boleh dipakai sekali per pengguna.
    const dupe = await db.bankCard.findFirst({
      where: { userId, bankName, accountNumber },
    });
    if (dupe) {
      return NextResponse.json(
        { error: "Kartu dengan bank & nomor rekening ini sudah ditambahkan." },
        { status: 400 }
      );
    }

    const created = await db.bankCard.create({
      data: { userId, holderName, bankName, accountNumber, phone },
    });

    return NextResponse.json({
      card: {
        id: created.id,
        holderName: created.holderName,
        bankName: created.bankName,
        accountNumber: created.accountNumber,
        phone: created.phone,
        createdAt: created.createdAt.toISOString(),
      },
      kind: isEwallet(created.bankName) ? "EWALLET" : "BANK",
    });
  } catch (err) {
    console.error("bank-cards create error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}

/** DELETE /api/bank-cards?id=...&userId=... — hapus kartu milik sendiri. */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")?.trim() ?? "";
  const userId = req.nextUrl.searchParams.get("userId")?.trim() ?? "";
  if (!id || !userId) {
    return NextResponse.json({ error: "id & userId wajib." }, { status: 400 });
  }

  try {
    const card = await db.bankCard.findUnique({ where: { id } });
    if (!card || card.userId !== userId) {
      return NextResponse.json({ error: "Kartu tidak ditemukan." }, { status: 404 });
    }
    await db.bankCard.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("bank-cards delete error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}
