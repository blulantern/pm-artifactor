import { getPrisma } from "../src/client.js";
import { seedMethodologies } from "./seed-methodologies.js";
import { seedPoc } from "./seed-poc.js";

async function main() {
  const prisma = getPrisma();
  await seedMethodologies(prisma);
  await seedPoc(prisma);
  await prisma.$disconnect();
  console.log("Seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
