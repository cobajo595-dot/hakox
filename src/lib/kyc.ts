import type { KycIdType, KycStatus, KycView } from "@/lib/types";

/** Mapper baris Kyc Prisma → KycView (aman untuk dikirim ke klien, tanpa foto). */
export function mapKyc(k: {
  id: string;
  fullName: string;
  idType: string;
  idNumber: string;
  dateOfBirth: string;
  address: string;
  status: string;
  reviewNote: string | null;
  submittedAt: Date;
  reviewedAt: Date | null;
}): KycView {
  return {
    id: k.id,
    fullName: k.fullName,
    idType: (k.idType === "PASPOR" ? "PASPOR" : "KTP") as KycIdType,
    idNumber: k.idNumber,
    dateOfBirth: k.dateOfBirth,
    address: k.address,
    status: k.status as KycStatus,
    reviewNote: k.reviewNote,
    submittedAt: k.submittedAt.toISOString(),
    reviewedAt: k.reviewedAt?.toISOString() ?? null,
  };
}
