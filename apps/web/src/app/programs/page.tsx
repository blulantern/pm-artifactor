import { Shell } from "@/ui/shell";
import { Programs } from "@/ui/programs";
import { getProgramsView } from "@/server/view-models";

export const dynamic = "force-dynamic";

export default async function Page() {
  const view = await getProgramsView();
  return (
    <Shell active="programs" crumb="Programs">
      <Programs view={view} />
    </Shell>
  );
}
