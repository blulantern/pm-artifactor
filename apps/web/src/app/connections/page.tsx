import { Shell } from "@/ui/shell";
import { Connections } from "@/ui/connections";
import { getConnectionsView, getAtlassianView } from "@/server/view-models";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const notice = first(sp.error) ?? (first(sp.connected) ? `Connected to ${first(sp.connected)}.` : undefined);
  const [view, atlassian] = await Promise.all([getConnectionsView(), getAtlassianView()]);
  return (
    <Shell active="connections" crumb="Connections">
      <Connections view={view} atlassian={atlassian} notice={notice} />
    </Shell>
  );
}
