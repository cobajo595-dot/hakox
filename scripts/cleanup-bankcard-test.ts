import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const email = "banktest@hakox.app";
  const user = await db.user.findUnique({ where: { email } });
  if (user) {
    const cards = await db.bankCard.count({ where: { userId: user.id } });
    await db.user.delete({ where: { id: user.id } });
    console.log(`deleted user ${email} (cascade ${cards} bank cards)`);
  } else {
    console.log("user not found, nothing to do");
  }

  const remainingCards = await db.bankCard.count();
  const users = await db.user.findMany({ select: { email: true, cashUsd: true } });
  console.log("bank cards left:", remainingCards);
  console.log("users left:", users.map((u) => `${u.email}(${u.cashUsd})`).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
