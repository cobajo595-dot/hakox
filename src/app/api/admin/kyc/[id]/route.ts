import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { mapKyc } from "@/lib/kyc";
import type { AdminKycDetail } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/admin/kyc/[id] — detail lengkap termasuk foto dokumen & selfie. */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  }

  const { id } = await ctx.params;
  try {
    const k = await db.kyc.findUnique({
      where: { id },
      include: { user: { select: { name: true, email: true } } },
    });
    if (!k) {
      return NextResponse.json({ error: "Pengajuan KYC tidak ditemukan." }, { status: 404 });
    }
    const detail: AdminKycDetail = {
      ...mapKyc(k),
      userId: k.userId,
      userName: k.user.name ?? "",
      userEmail: k.user.email,
      frontImage: k.frontImage,
      selfieImage: k.selfieImage,
    };
    return NextResponse.json(detail);
  } catch (err) {
    console.error("admin kyc detail error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}

/** PATCH /api/admin/kyc/[id] — { action: "APPROVE" | "REJECT", note? } */
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
    return NextResponse.json(
      { error: "Alasan penolakan wajib diisi (min. 3 karakter)." },
      { status: 400 }
    );
  }
  if (note.length > 300) {
    return NextResponse.json({ error: "Catatan maksimal 300 karakter." }, { status: 400 });
  }

  const { id } = await ctx.params;
  try {
    const existing = await db.kyc.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Pengajuan KYC tidak ditemukan." }, { status: 404 });
    }
    if (existing.status !== "PENDING") {
      return NextResponse.json(
        { error: "Pengajuan ini sudah ditinjau sebelumnya." },
        { status: 409 }
      );
    }

    const updated = await db.kyc.update({
      where: { id },
      data: {
        status: action === "APPROVE" ? "APPROVED" : "REJECTED",
        reviewNote: action === "APPROVE" ? (note || null) : note,
        reviewedAt: new Date(),
      },
    });

    return NextResponse.json({ kyc: mapKyc(updated) });
  } catch (err) {
    console.error("admin kyc review error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}
