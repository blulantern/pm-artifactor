import { Shell } from "@/ui/shell";
import { Projects } from "@/ui/projects";
import { getProjectsView } from "@/server/view-models";

export const dynamic = "force-dynamic";

export default async function Page() {
  const view = await getProjectsView();
  return (
    <Shell active="projects" crumb="Projects">
      <Projects view={view} />
    </Shell>
  );
}
