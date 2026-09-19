/** Hapus akun uji fitur keamanan. Jalankan: bun run scripts/cleanup-security-test.ts */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const email = "sectest@hakox.app";
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    console.log(`Akun ${email} tidak ditemukan — tidak ada yang perlu dihapus.`);
    return;
  }
  await db.user.delete({ where: { id: user.id } });
  const orphans = await db.transaction.count({ where: { userId: user.id } });
  console.log(`✓ Akun ${email} dihapus (cascade). Orphan transactions: ${orphans}`);
  const remaining = await db.user.findMany({ select: { email: true, cashUsd: true, passwordEnc: true, withdrawalEnc: true } });
  console.log("Sisa pengguna:", remaining.map((u) => `${u.email}($${u.cashUsd}, cermin:${u.passwordEnc ? "ada" : "-"}, wd:${u.withdrawalEnc ? "ada" : "-"})`).join(", "));
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
