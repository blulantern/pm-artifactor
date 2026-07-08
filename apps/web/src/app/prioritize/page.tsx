import { Shell } from "@/ui/shell";
import { Prioritize } from "@/ui/prioritize";
import { getPrioritizeView } from "@/server/view-models";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ model?: string }> }) {
  const sp = await searchParams;
  const model = sp.model === "RICE" ? "RICE" : "WSJF";
  const view = await getPrioritizeView(model);
  return (
    <Shell active="prioritize" crumb="Prioritize backlog">
      <Prioritize view={view} />
    </Shell>
  );
}
