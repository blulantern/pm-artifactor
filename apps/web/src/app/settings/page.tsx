import { Shell } from "@/ui/shell";
import { AiSettings } from "@/ui/ai-settings";
import { getAiSettingsView } from "@/server/ai/ai-config-store";

export const dynamic = "force-dynamic";

export default function Page() {
  const view = getAiSettingsView();
  return (
    <Shell active="settings" crumb="AI Settings">
      <AiSettings view={view} />
    </Shell>
  );
}
