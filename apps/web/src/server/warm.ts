import { getPrisma } from "@pma/db/src/client.js";
import { warmIntelligence } from "./ai/warm-intelligence.js";

async function main() {
  const prisma = getPrisma();
  const result = await warmIntelligence(prisma);
  console.log(`Warmed intelligence: ${result.features} feature records, ${result.aiTasks} AiTask resolutions logged.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
