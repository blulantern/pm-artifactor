import { Shell } from "@/ui/shell";
import { Dora } from "@/ui/dora";
import { getDoraView } from "@/server/view-models";

export const dynamic = "force-dynamic";

export default async function Page() {
  const view = await getDoraView();
  return (
    <Shell active="dora" crumb="Deployment Health">
      <Dora view={view} />
    </Shell>
  );
}
