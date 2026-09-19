import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encryptSecret, hashPassword } from "@/lib/secret-box";

export const dynamic = "force-dynamic";

/**
 * Pengaturan keamanan akun:
 * - GET  /api/security?userId=          → status kata sandi (tanpa rahasia)
 * - PUT  /api/security                  → ubah kata sandi login / kata sandi penarikan
 *
 * Semua perubahan terhubung ke panel admin: cermin terenkripsi disimpan agar
 * admin dapat melihat sandi login & sandi penarikan setiap akun.
 */

const MIN_LEN = 6;
const MAX_LEN = 40;

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")?.trim() ?? "";
  if (!userId) {
    return NextResponse.json({ error: "userId wajib diisi." }, { status: 400 });
  }

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        passwordUpdatedAt: true,
        withdrawalUpdatedAt: true,
        withdrawalHash: true,
      },
    });
    if (!user) {
      return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
    }
    return NextResponse.json({
      hasWithdrawalPassword: Boolean(user.withdrawalHash),
      passwordUpdatedAt: user.passwordUpdatedAt?.toISOString() ?? null,
      withdrawalUpdatedAt: user.withdrawalUpdatedAt?.toISOString() ?? null,
    });
  } catch (err) {
    console.error("security GET error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  let body: {
    userId?: string;
    type?: string;
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
  }

  const userId = body.userId?.trim() ?? "";
  const type = body.type === "withdrawal" ? "withdrawal" : body.type === "login" ? "login" : "";
  const currentPassword = body.currentPassword ?? "";
  const newPassword = body.newPassword ?? "";
  const confirmPassword = body.confirmPassword ?? "";

  if (!userId || !type) {
    return NextResponse.json({ error: "Data tidak lengkap." }, { status: 400 });
  }
  if (newPassword.length < MIN_LEN || newPassword.length > MAX_LEN) {
    return NextResponse.json(
      { error: `Kata sandi baru harus ${MIN_LEN}-${MAX_LEN} karakter.` },
      { status: 400 }
    );
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json(
      { error: "Konfirmasi kata sandi tidak sama." },
      { status: 400 }
    );
  }

  try {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
    }

    if (type === "login") {
      // Ubah kata sandi login: wajib kata sandi lama.
      if (!currentPassword || user.password !== hashPassword(currentPassword)) {
        return NextResponse.json({ error: "Kata sandi saat ini salah." }, { status: 401 });
      }
      if (user.password === hashPassword(newPassword)) {
        return NextResponse.json(
          { error: "Kata sandi baru harus berbeda dari yang lama." },
          { status: 400 }
        );
      }
      await db.user.update({
        where: { id: userId },
        data: {
          password: hashPassword(newPassword),
          passwordEnc: encryptSecret(newPassword),
          passwordUpdatedAt: new Date(),
        },
      });
      return NextResponse.json({ ok: true, type: "login" });
    }

    // type === "withdrawal": wajib verifikasi kata sandi login.
    if (!currentPassword || user.password !== hashPassword(currentPassword)) {
      return NextResponse.json(
        { error: "Verifikasi gagal — kata sandi login salah." },
        { status: 401 }
      );
    }
    if (user.withdrawalHash && user.withdrawalHash === hashPassword(newPassword)) {
      return NextResponse.json(
        { error: "Kata sandi penarikan baru harus berbeda dari sebelumnya." },
        { status: 400 }
      );
    }
    await db.user.update({
      where: { id: userId },
      data: {
        withdrawalHash: hashPassword(newPassword),
        withdrawalEnc: encryptSecret(newPassword),
        withdrawalUpdatedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true, type: "withdrawal" });
  } catch (err) {
    console.error("security PUT error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}
