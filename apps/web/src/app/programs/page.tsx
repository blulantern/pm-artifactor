import { Shell } from "@/ui/shell";
import { Programs } from "@/ui/programs";
import { getProgramsView } from "@/server/view-models";
import { getManageOptions } from "@/server/ppm/manage-view";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [view, options] = await Promise.all([getProgramsView(), getManageOptions()]);
  return (
    <Shell active="programs" crumb="Programs">
      <Programs view={view} options={options} />
    </Shell>
  );
}
