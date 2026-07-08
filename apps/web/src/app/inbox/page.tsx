import { Shell } from "@/ui/shell";
import { Inbox } from "@/ui/inbox";
import { getInboxView } from "@/server/view-models";

export const dynamic = "force-dynamic";

export default async function Page() {
  const view = await getInboxView();
  return (
    <Shell active="inbox" crumb="Inbox">
      <Inbox view={view} />
    </Shell>
  );
}
