import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { effectiveCashUsd } from "@/lib/balance";
import { encryptSecret, hashPassword } from "@/lib/secret-box";

function hash(pw: string): string {
  return hashPassword(pw);
}

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; mode?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const mode = body.mode === "register" ? "register" : "login";
  const name = (body.name ?? "").trim() || null;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Format email tidak valid." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Kata sandi minimal 6 karakter." }, { status: 400 });
  }

  try {
    if (mode === "register") {
      const exists = await db.user.findUnique({ where: { email } });
      if (exists) {
        return NextResponse.json(
          { error: "Email sudah terdaftar. Silakan masuk." },
          { status: 409 }
        );
      }
      // Akun baru selalu dimulai dengan saldo 0 — dana hanya masuk
      // melalui pengajuan Isi Dana yang disetujui admin.
      // Cermin terenkripsi disimpan agar admin dapat membantu verifikasi kata sandi.
      const user = await db.user.create({
        data: {
          email,
          password: hash(password),
          passwordEnc: encryptSecret(password),
          passwordUpdatedAt: new Date(),
          name,
          cashUsd: 0,
        },
      });
      return NextResponse.json({
        user: { id: user.id, email: user.email, name: user.name ?? "", cashUsd: user.cashUsd },
      });
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user || user.password !== hash(password)) {
      return NextResponse.json({ error: "Email atau kata sandi salah." }, { status: 401 });
    }
    // Saldo tampil 0 selama belum ada deposit yang disetujui admin.
    const cash = await effectiveCashUsd(user.id, user.cashUsd);
    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name ?? "", cashUsd: cash },
    });
  } catch (err) {
    console.error("auth error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}
