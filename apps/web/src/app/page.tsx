import { Shell } from "@/ui/shell";
import { Today } from "@/ui/today";
import { getTodayView } from "@/server/view-models";

export const dynamic = "force-dynamic";

export default async function Page() {
  const view = await getTodayView();
  return (
    <Shell active="today" crumb="Today">
      <Today view={view} />
    </Shell>
  );
}
