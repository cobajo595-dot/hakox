import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminHash, ensureAdmin, makeToken } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
  }

  const username = (body.username ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!username || !password) {
    return NextResponse.json({ error: "Username dan kata sandi wajib diisi." }, { status: 400 });
  }

  try {
    await ensureAdmin();
    const admin = await db.admin.findUnique({ where: { username } });
    if (!admin || admin.passwordHash !== adminHash(password)) {
      return NextResponse.json(
        { error: "Username atau kata sandi salah." },
        { status: 401 }
      );
    }
    await db.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });
    return NextResponse.json({ token: makeToken(admin.username), username: admin.username });
  } catch (err) {
    console.error("admin login error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}
