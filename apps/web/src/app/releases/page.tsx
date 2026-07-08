import { Shell } from "@/ui/shell";
import { Releases } from "@/ui/releases";
import { getReleasesView } from "@/server/view-models";

export const dynamic = "force-dynamic";

export default async function Page() {
  const view = await getReleasesView();
  return (
    <Shell active="releases" crumb="Release Command Center">
      <Releases view={view} />
    </Shell>
  );
}
