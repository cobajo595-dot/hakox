/**
 * Daftar bank Indonesia + e-wallet untuk kartu bank pengguna.
 * Dipakai aplikasi (form tambah kartu) & panel admin (label jenis rekening).
 */

export const ID_BANKS: string[] = [
  "BCA",
  "Bank Mandiri",
  "BNI",
  "BRI",
  "Bank Syariah Indonesia (BSI)",
  "CIMB Niaga",
  "Permata Bank",
  "Danamon",
  "Panin Bank",
  "Bank Mega",
  "OCBC NISP",
  "Maybank Indonesia",
  "UOB Indonesia",
  "Bank BJB",
  "Bank DKI",
  "Bank Jateng",
  "Bank Jatim",
  "Bank Sulsel",
  "Bank NTB",
  "Bank Papua",
  "Bank Nagari",
  "KB Bukopin",
  "Bank Victoria",
  "Bank Sinarmas",
  "Bank Sahabat Sampoerna",
  "Bank Neo Commerce",
  "Bank Jago",
  "SeaBank Indonesia",
  "Bank Aladin",
  "Bank BNC",
  "Bank KEB Hana",
  "Bank IBK Indonesia",
  "Bank CCBI",
  "Bank Woori Saudara",
  "Bank QNB Indonesia",
  "Bank Maspion",
  "Bank Ganesha",
  "Bank Oke",
  "Bank Prima",
  "Bank HSBC Indonesia",
  "Standard Chartered Indonesia",
  "Bank ICBC Indonesia",
  "Bank Commonwealth",
  "Bank Resona Perdania",
  "Bank Shinhan Indonesia",
  "Bank Bisnis Internasional",
];

export const ID_EWALLETS: string[] = [
  "GoPay",
  "OVO",
  "DANA",
  "ShopeePay",
  "LinkAja",
  "DOKU",
  "Paytren",
  "PayPal",
];

/** Semua pilihan bank + e-wallet. */
export const ALL_BANK_OPTIONS: string[] = [...ID_BANKS, ...ID_EWALLETS];

/** True bila nama bank termasuk kategori e-wallet. */
export function isEwallet(bankName: string): boolean {
  return ID_EWALLETS.includes(bankName);
}
