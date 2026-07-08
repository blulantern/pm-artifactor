import { Shell } from "@/ui/shell";
import { Stakeholders } from "@/ui/stakeholders";
import { getStakeholdersView } from "@/server/view-models";

export const dynamic = "force-dynamic";

export default async function Page() {
  const view = await getStakeholdersView();
  return (
    <Shell active="stakeholders" crumb="Stakeholders">
      <Stakeholders view={view} />
    </Shell>
  );
}
