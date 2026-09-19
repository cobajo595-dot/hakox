import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import type { NoticeRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  }
  try {
    const rows = await db.notice.findMany({ orderBy: { createdAt: "desc" } });
    const notices: NoticeRow[] = rows.map((n) => ({
      id: n.id,
      content: n.content,
      active: n.active,
      createdAt: n.createdAt.toISOString(),
    }));
    return NextResponse.json({ notices });
  } catch (err) {
    console.error("admin notices GET error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  }

  let body: { content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
  }

  const content = (body.content ?? "").trim();
  if (content.length < 3 || content.length > 160) {
    return NextResponse.json(
      { error: "Isi pengumuman harus 3-160 karakter." },
      { status: 400 }
    );
  }

  try {
    const notice = await db.notice.create({ data: { content } });
    return NextResponse.json({
      notice: {
        id: notice.id,
        content: notice.content,
        active: notice.active,
        createdAt: notice.createdAt.toISOString(),
      } satisfies NoticeRow,
    });
  } catch (err) {
    console.error("admin notices POST error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  }

  let body: { id?: string; active?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
  }

  if (!body.id || typeof body.active !== "boolean") {
    return NextResponse.json({ error: "id dan active wajib diisi." }, { status: 400 });
  }

  try {
    await db.notice.update({ where: { id: body.id }, data: { active: body.active } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("admin notices PATCH error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id wajib diisi." }, { status: 400 });
  }

  try {
    await db.notice.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("admin notices DELETE error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}
