import { redirect } from "next/navigation";
import { vaultSession } from "@/server/vault/vault-store";
import { VaultSetupForm } from "@/ui/vault-setup-form";

export const dynamic = "force-dynamic";

export default async function Page() {
  if ((await vaultSession.status()) !== "unconfigured") redirect("/");
  return <VaultSetupForm />;
}
