import { Shell } from "@/ui/shell";
import { PersonDetail } from "@/ui/person-detail";
import { getPersonView } from "@/server/view-models";
import { isRecordNotFound } from "@/server/errors";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let view: Awaited<ReturnType<typeof getPersonView>>;
  try {
    view = await getPersonView(id);
  } catch (err) {
    if (!isRecordNotFound(err)) throw err; // real DB errors must surface, not 404
    return (
      <Shell active="team" crumb="Team › not found">
        <div className="view">
          <div className="h1">Person not found</div>
          <div className="sub" style={{ marginTop: 6 }}>
            No teammate matches &ldquo;{id}&rdquo;. They may have been removed or the link is stale.
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell active="team" crumb={`Team › ${view.name}`}>
      <PersonDetail view={view} />
    </Shell>
  );
}
