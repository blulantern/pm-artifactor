import { Shell } from "@/ui/shell";
import { ProjectDetail } from "@/ui/project-detail";
import { getProjectView } from "@/server/view-models";
import { isRecordNotFound } from "@/server/errors";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let view: Awaited<ReturnType<typeof getProjectView>>;
  try {
    view = await getProjectView(id);
  } catch (err) {
    if (!isRecordNotFound(err)) throw err; // real DB errors must surface, not 404
    return (
      <Shell active="projects" crumb="Project not found">
        <div className="view">
          <div className="h1">Project not found</div>
          <div className="sub" style={{ marginTop: 6 }}>
            No project matches &ldquo;{id}&rdquo;. It may have been removed or the link is stale.
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell active="projects" crumb={view.name}>
      <ProjectDetail view={view} />
    </Shell>
  );
}
