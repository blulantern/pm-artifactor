import { Shell } from "@/ui/shell";
import { Connections } from "@/ui/connections";
import { getConnectionsView } from "@/server/view-models";

export const dynamic = "force-dynamic";

export default async function Page() {
  const view = await getConnectionsView();
  return (
    <Shell active="connections" crumb="Connections">
      <Connections view={view} />
    </Shell>
  );
}
