import { Shell } from "@/ui/shell";
import { Team } from "@/ui/team";
import { getTeamView } from "@/server/view-models";

export const dynamic = "force-dynamic";

export default async function Page() {
  const view = await getTeamView();
  return (
    <Shell active="team" crumb="Team">
      <Team view={view} />
    </Shell>
  );
}
