/**
 * Helper mata uang untuk alur Isi Dana / Tarik Dana.
 *
 * Pengajuan dana DIAJUKAN dalam RUPIAH (IDR) — sesuai kebiasaan pengguna
 * Indonesia — sedangkan saldo di Aset disimpan dan ditampilkan dalam USDT.
 * Konversi memakai kurs USD→IDR nyata (lihat getUsdIdrRate di lib/market-data)
 * yang dihitung di server pada saat pengajuan, sehingga tidak ada perbedaan
 * kurs antara saat pengajuan dan saat persetujuan admin.
 */

/** Pengajuan minimal: Rp 100.000 */
export const IDR_MIN_REQUEST = 100_000;

/** Pengajuan maksimal per transaksi: Rp 10.000.000.000 */
export const IDR_MAX_REQUEST = 10_000_000_000;

/** Format angka jadi teks Rupiah: 1500000 -> "Rp 1.500.000". */
export function fmtIdr(n: number, opts?: { sign?: boolean }): string {
  if (!Number.isFinite(n)) return "Rp 0";
  const sign = n < 0 ? "-" : opts?.sign ? "+" : "";
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("id-ID", { maximumFractionDigits: 0 });
  return `${sign}Rp ${formatted}`;
}

/** Format saldo USDT: 350 -> "350.00 USDT". */
export function fmtUsdt(n: number, opts?: { sign?: boolean }): string {
  if (!Number.isFinite(n)) return "0.00 USDT";
  const sign = n < 0 ? "-" : opts?.sign ? "+" : "";
  const abs = Math.abs(n);
  const decimals = abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${sign}${formatted} USDT`;
}

/** Ubah input pengguna ("1.500.000", "1500000", "1,5jt" tanpa satuan) menjadi angka murni. */
export function parseIdr(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  if (digits === "") return 0;
  return Number(digits);
}

/** Format saat mengetik: hanya angka, dikelompokkan dengan titik: "1500000" -> "1.500.000". */
export function formatIdrInput(raw: string): string {
  const digits = raw
    .replace(/\D/g, "")
    .replace(/^0+(?=\d)/, "")
    .slice(0, 13); // cukup untuk Rp 10.000.000.000+
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Bulatkan jumlah USDT ke 2 desimal (mesin saldo memakai 2 desimal). */
export function roundUsdt(n: number): number {
  return Math.round(n * 100) / 100;
}
