// One-off cleanup: remove all demo accounts (cascade deletes holdings/trades/positions/favorites/transactions)
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const demoUsers = await db.user.findMany({
    where: {
      OR: [{ email: "demo@hakox.app" }, { name: { equals: "Trader Demo" } }],
    },
    select: { id: true, email: true, name: true },
  });

  for (const u of demoUsers) {
    await db.user.delete({ where: { id: u.id } });
    console.log("DELETED:", u.email, u.name, u.id);
  }

  if (demoUsers.length === 0) console.log("No demo accounts found.");

  const remaining = await db.user.findMany({
    select: { email: true, name: true, cashUsd: true },
    orderBy: { createdAt: "asc" },
  });
  console.log("Remaining users:", JSON.stringify(remaining, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
