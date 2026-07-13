import { Shell } from "@/ui/shell";
import { Projects } from "@/ui/projects";
import { getProjectsView } from "@/server/view-models";
import { getManageOptions } from "@/server/ppm/manage-view";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [view, options] = await Promise.all([getProjectsView(), getManageOptions()]);
  return (
    <Shell active="projects" crumb="Projects">
      <Projects view={view} options={options} />
    </Shell>
  );
}
