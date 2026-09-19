import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mapKyc } from "@/lib/kyc";

export const dynamic = "force-dynamic";

const MAX_IMAGE_CHARS = 2_500_000; // ~1.8 MB data URL

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")?.trim() ?? "";
  if (!userId) {
    return NextResponse.json({ error: "userId wajib diisi." }, { status: 400 });
  }

  try {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
    }
    const kyc = await db.kyc.findUnique({ where: { userId } });
    return NextResponse.json({ kyc: kyc ? mapKyc(kyc) : null });
  } catch (err) {
    console.error("kyc get error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!userId) {
    return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
  }

  try {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
    }

    const existing = await db.kyc.findUnique({ where: { userId } });
    if (existing && existing.status !== "REJECTED") {
      return NextResponse.json(
        {
          error:
            existing.status === "PENDING"
              ? "Ajukan KYC Anda masih ditinjau. Mohon tunggu."
              : "Akun Anda sudah terverifikasi.",
        },
        { status: 409 }
      );
    }

    // ===== Validasi =====
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    if (fullName.length < 3 || fullName.length > 80) {
      return NextResponse.json(
        { error: "Nama lengkap harus 3-80 karakter sesuai dokumen." },
        { status: 400 }
      );
    }

    const idType = body.idType === "PASPOR" ? "PASPOR" : "KTP";
    const idNumber = typeof body.idNumber === "string" ? body.idNumber.trim().toUpperCase() : "";
    if (idType === "KTP" && !/^\d{16}$/.test(idNumber)) {
      return NextResponse.json(
        { error: "Nomor KTP (NIK) harus tepat 16 digit angka." },
        { status: 400 }
      );
    }
    if (idType === "PASPOR" && !/^[A-Z0-9]{6,12}$/.test(idNumber)) {
      return NextResponse.json(
        { error: "Nomor paspor harus 6-12 huruf/angka." },
        { status: 400 }
      );
    }

    const dateOfBirth = typeof body.dateOfBirth === "string" ? body.dateOfBirth.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || Number.isNaN(Date.parse(dateOfBirth))) {
      return NextResponse.json({ error: "Tanggal lahir tidak valid." }, { status: 400 });
    }
    const dob = new Date(`${dateOfBirth}T00:00:00Z`);
    const ageYears = (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000);
    if (ageYears < 17 || ageYears > 120) {
      return NextResponse.json(
        { error: "Anda harus berusia minimal 17 tahun untuk verifikasi KYC." },
        { status: 400 }
      );
    }

    const address = typeof body.address === "string" ? body.address.trim() : "";
    if (address.length < 10 || address.length > 200) {
      return NextResponse.json(
        { error: "Alamat domisili harus 10-200 karakter." },
        { status: 400 }
      );
    }

    const frontImage = typeof body.frontImage === "string" ? body.frontImage : "";
    const selfieImage = typeof body.selfieImage === "string" ? body.selfieImage : "";
    for (const [label, img] of [
      ["Foto dokumen", frontImage],
      ["Foto selfie", selfieImage],
    ] as const) {
      if (!img.startsWith("data:image/")) {
        return NextResponse.json({ error: `${label} wajib diunggah.` }, { status: 400 });
      }
      if (img.length > MAX_IMAGE_CHARS) {
        return NextResponse.json(
          { error: `${label} terlalu besar. Maksimal sekitar 2 MB.` },
          { status: 400 }
        );
      }
    }

    const data = {
      fullName,
      idType,
      idNumber,
      dateOfBirth,
      address,
      frontImage,
      selfieImage,
      status: "PENDING" as const,
      reviewNote: null,
      reviewedAt: null,
      submittedAt: new Date(),
    };

    const kyc = existing
      ? await db.kyc.update({ where: { userId }, data })
      : await db.kyc.create({ data: { ...data, userId } });

    return NextResponse.json({ kyc: mapKyc(kyc) });
  } catch (err) {
    console.error("kyc submit error", err);
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}
