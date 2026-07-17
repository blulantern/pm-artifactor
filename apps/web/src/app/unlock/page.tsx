import { redirect } from "next/navigation";
import { vaultSession } from "@/server/vault/vault-store";
import { UnlockForm } from "@/ui/unlock-form";

export const dynamic = "force-dynamic";

export default async function Page() {
  const status = await vaultSession.status();
  if (status === "unconfigured") redirect("/vault/setup");
  if (status === "unlocked") redirect("/");
  return <UnlockForm />;
}
