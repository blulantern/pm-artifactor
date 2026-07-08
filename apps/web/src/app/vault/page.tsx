import { Shell } from "@/ui/shell";
import { Vault } from "@/ui/vault";
import { getVaultView } from "@/server/view-models";

export const dynamic = "force-dynamic";

export default async function Page() {
  const view = await getVaultView();
  return (
    <Shell active="vault" crumb="Your Vault">
      <Vault view={view} />
    </Shell>
  );
}
