# HakoX — Exchange Kripto Sederhana (H5)

Aplikasi web exchange kripto bergaya H5 (mobile-first) berbahasa Indonesia: trading spot, kontrak
ber-leverage, opsi naik/turun (binary options), alur isi/tarik dana dengan persetujuan admin, KYC,
kartu bank, live chat, dan **panel admin lengkap** di `/admin`.

> ⚠️ **Disclaimer**: ini adalah aplikasi **demo / paper-trading**. Semua saldo adalah saldo simulasi
> dan harga mengikuti data pasar publik (CoinGecko). Bukan untuk keperluan trading uang nyata.

---

## ✨ Fitur

### Aplikasi (client)
- **Beranda** — banner carousel, pengumuman berjalan (ticker), aksi cepat, market list
- **Pasar** — daftar koin harga real-time (CoinGecko, cache 45s), pencarian & favorit
- **Trade** —
  - Tab **Opsi Naik/Turun**: chart candlestick (klinecharts), tombol Beli Naik / Beli Turun,
    durasi 5–30 menit, profit mengikuti durasi, countdown & settle otomatis
  - Tab **Spot**: beli/jual koin dari saldo USDT
- **Kontrak** — posisi LONG/SHORT leverage 1–20x, margin, PnL real-time, tutup posisi
- **Aset** — total aset, riwayat transaksi, kepemilikan koin
- **Isi/Tarik Dana** — pengajuan IDR dengan alur persetujuan admin (PENDING → APPROVED/REJECTED)
- **KYC** — upload KTP/Paspor + selfie, direview admin
- **Kartu Bank** — kelola rekening bank / e-wallet (BCA, Mandiri, GoPay, OVO, dll.)
- **Keamanan** — kata sandi penarikan terpisah, ganti kata sandi
- **Live Chat** — chat real-time dengan admin (socket.io)
- Multi-bahasa (ID/EN), responsif mobile & desktop

### Panel Admin (`/admin`)
- **Ringkasan** — statistik pengguna, volume, transaksi terbaru
- **Pengguna** — daftar/cari pengguna, **+ Saldo** (kredit langsung aktif di client),
  **Hapus lembut** (akun dinonaktifkan, data tersimpan, bisa **dipulihkan** — pengguna tidak
  perlu mendaftar ulang)
- **Keamanan Akun** — lihat cermin kata sandi (terenkripsi) untuk bantu verifikasi
- **Verifikasi KYC** — ACC/tolak pengajuan
- **Setoran & Tarik Dana** — persetujuan deposit/withdrawal + catatan review
- **Kartu Bank** — rekening terdaftar semua pengguna
- **Live Chat** — balas chat pengguna real-time
- **Kontrol Trading** — paksa arah harga per simbol (AUTO/NAIK/TURUN) & paksa hasil opsi
- **Riwayat Trade / Posisi** — semua aktivitas trading
- **Pengumuman** — kelola ticker berita

---

## 🛠 Teknologi

| Bagian | Teknologi |
|---|---|
| Framework | [Next.js](https://nextjs.org) (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui + Lucide icons |
| Chart | [klinecharts](https://klinecharts.com) (candlestick) |
| Database | SQLite via [Prisma ORM](https://prisma.io) |
| Real-time | socket.io (mini-service terpisah, port 3003) |
| Runtime | [Bun](https://bun.sh) |
| Harga | CoinGecko public API (cache 45s + fallback statis) |

---

## 🚀 Cara Menjalankan

> Prasyarat: [Bun](https://bun.sh) terpasang.

```bash
# 1. Install dependencies
bun install

# 2. Siapkan environment
cp .env.example .env       # sesuaikan bila perlu

# 3. Buat schema database (SQLite)
bun run db:push

# 4. Jalankan aplikasi (port 3000)
bun run dev

# 5. (Opsional) Jalankan layanan live chat (port 3003)
cd mini-services/chat-service && bun run dev
```

Buka `http://localhost:3000` untuk aplikasi, dan `http://localhost:3000/admin` untuk panel admin.

### Akun admin bawaan

| Username | Kata sandi |
|---|---|
| `admin` | `admin123` |

> 🔴 **Penting**: segera ganti kata sandi admin lewat menu **Pengaturan** di panel admin sebelum
> dipakai. Untuk produksi, juga wajib mengganti `ADMIN_SECRET` dan `HAKOX_SECRET_KEY` di `.env`.

---

## 📁 Struktur Proyek

```
src/
├── app/
│   ├── page.tsx              # Aplikasi H5 (login + 5 tab)
│   ├── admin/                # Panel admin terpisah
│   └── api/                  # REST API (auth, assets, trade, binary, wallet, admin, ...)
├── components/
│   ├── exchange/             # Trade view, chart, binary, wallet dialog, ...
│   ├── admin/                # Komponen panel admin
│   └── ui/                   # shadcn/ui
├── lib/                      # db, balance gate, enkripsi, market data, tipe
prisma/schema.prisma          # Skema database
mini-services/chat-service/   # Socket.io chat (SQLite terpisah)
```

### Aturan dana (paper trading)
Saldo efektif pengguna hanya aktif setelah ada sumber dana resmi: **deposit di-ACC admin**
atau **kredit manual admin** (tombol `+ Saldo`). Registrasi baru selalu mulai dari saldo 0.

---

## 📄 Lisensi

Bebas digunakan untuk keperluan pembelajaran/demo.
