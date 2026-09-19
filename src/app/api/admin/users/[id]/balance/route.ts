import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/** Penyesuaian saldo tunai pengguna oleh admin. amount bisa negatif. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  }

  const { id } = await ctx.params;

  let body: { amount?: number; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
  }

  const amount = Number(body.amount);
  const note = (body.note ?? "").trim() || null;

  if (!Number.isFinite(amount) || amount === 0) {
    return NextResponse.json({ error: "Jumlah harus bukan nol." }, { status: 400 });
  }

  try {
    const user = await db.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
    }
    if (amount < 0 && user.cashUsd + amount < 0) {
      return NextResponse.json(
        { error: `Pengurangan melebihi saldo tunai (${user.cashUsd.toFixed(2)}).` },
        { status: 400 }
      );
    }

    const [updated] = await db.$transaction([
      db.user.update({ where: { id }, data: { cashUsd: { increment: amount } } }),
      db.transaction.create({
        data: {
          userId: id,
          type: "ADMIN_ADJUST",
          amountUsd: amount,
          note: note ?? `Penyesuaian manual oleh admin (${admin})`,
        },
      }),
    ]);

    return NextResponse.json({ cashUsd: updated.cashUsd });
  } catch (err) {
    console.error("admin balance adjust error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}
