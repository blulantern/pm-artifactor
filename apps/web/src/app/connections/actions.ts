"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { vaultSession } from "@/server/vault/vault-store";
import { writeClientCreds, removeClientCreds } from "@/server/integrations/atlassian/atlassian-store";
import { beginConnect, chooseSite, disconnect } from "@/server/integrations/atlassian/connect-service";

/**
 * Write-only: the client secret goes in and is never read back to the browser
 * (the view exposes presence only). Mirrors the AI-keys pattern.
 */
export async function saveAtlassianClient(input: {
  clientId: string;
  clientSecret: string;
}): Promise<{ ok: boolean; error?: string }> {
  if ((await vaultSession.status()) !== "unlocked") {
    return { ok: false, error: "Unlock the vault before saving Atlassian credentials." };
  }
  const clientId = input.clientId.trim();
  const clientSecret = input.clientSecret.trim();
  if (!clientId || !clientSecret) return { ok: false, error: "Client ID and client secret are both required." };
  await writeClientCreds({ clientId, clientSecret });
  revalidatePath("/connections");
  return { ok: true };
}

/** Remove the stored client ID + secret from the vault. Existing site connections keep their
 * tokens, but can no longer refresh until credentials are re-added. */
export async function clearAtlassianClient(): Promise<{ ok: boolean; error?: string }> {
  if ((await vaultSession.status()) !== "unlocked") {
    return { ok: false, error: "Unlock the vault before clearing Atlassian credentials." };
  }
  await removeClientCreds();
  revalidatePath("/connections");
  return { ok: true };
}

export async function startAtlassianConnect(): Promise<never> {
  if ((await vaultSession.status()) !== "unlocked") {
    redirect("/connections?error=" + encodeURIComponent("Unlock the vault to connect."));
  }
  let url: string;
  try {
    url = await beginConnect();
  } catch {
    redirect("/connections?error=" + encodeURIComponent("Add your Atlassian client ID and secret first."));
  }
  redirect(url);
}

export async function chooseAtlassianSite(site: {
  cloudId: string;
  siteUrl: string;
  siteName: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await chooseSite(db(), site);
    revalidatePath("/connections");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not attach that site." };
  }
}

export async function disconnectAtlassian(cloudId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await disconnect(db(), cloudId);
    revalidatePath("/connections");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not disconnect." };
  }
}
