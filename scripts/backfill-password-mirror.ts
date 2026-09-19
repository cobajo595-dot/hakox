/**
 * Coba isi passwordEnc untuk akun lama (sebelum fitur keamanan) dari kamus
 * kata sandi demo yang umum dipakai pada sesi pengujian sebelumnya.
 * Jalankan: bun run scripts/backfill-password-mirror.ts
 */
import { PrismaClient } from "@prisma/client";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const db = new PrismaClient();

// Salin logika secret-box (tidak bisa diimpor karena berisi "server-only")
const KEY = createHash("sha256").update(process.env.HAKOX_SECRET_KEY ?? "hakox-secret-key-2025").digest();

function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

const SALT = "hakox-demo-salt";
const hash = (pw: string) => createHash("sha256").update(`${SALT}:${pw}`).digest("hex");

const DICTIONARY = [
  "password123",
  "test123456",
  "test1234",
  "testing123",
  "hakox123",
  "hako123456",
  "demo123456",
  "budi12345",
  "budi123456",
  "gigi12345",
  "gigi123456",
  "santoso123",
  "123456",
  "12345678",
  "123456789",
  "qwerty123",
  "abc12345",
  "password",
  "password1",
  "admin123",
  "indonesia123",
  "trader123",
  "crypto123",
  "btc123456",
  "sekret123",
  "rahasia123",
];

async function main() {
  const users = await db.user.findMany({
    where: { passwordEnc: null },
    select: { id: true, email: true, password: true },
  });
  console.log(`Akun tanpa cermin: ${users.map((u) => u.email).join(", ") || "(tidak ada)"}`);

  for (const u of users) {
    for (const pw of DICTIONARY) {
      if (hash(pw) === u.password) {
        await db.user.update({
          where: { id: u.id },
          data: { passwordEnc: encryptSecret(pw) },
        });
        console.log(`✓ ${u.email}: sandi ditemukan di kamus — cermin terenkripsi diisi.`);
        break;
      }
    }
  }
  console.log("Selesai.");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
