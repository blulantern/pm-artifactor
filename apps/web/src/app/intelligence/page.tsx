import { Shell } from "@/ui/shell";
import { Intel } from "@/ui/intel";
import { getIntelView } from "@/server/view-models";

export const dynamic = "force-dynamic";

export default async function Page() {
  const view = await getIntelView();
  return (
    <Shell active="intel" crumb="System Intelligence">
      <Intel view={view} />
    </Shell>
  );
}
