"use server";

import { redirect } from "next/navigation";
import { vaultSession } from "@/server/vault/vault-store";

const MIN_LEN = 8;

export async function setupVault(passphrase: string): Promise<{ ok: boolean; error?: string }> {
  if (passphrase.length < MIN_LEN) return { ok: false, error: `Passphrase must be at least ${MIN_LEN} characters.` };
  await vaultSession.configure(passphrase);
  return { ok: true };
}

export async function unlockVault(passphrase: string): Promise<{ ok: boolean; error?: string }> {
  const ok = await vaultSession.unlock(passphrase);
  return ok ? { ok: true } : { ok: false, error: "Incorrect passphrase." };
}

export async function lockVault(): Promise<never> {
  await vaultSession.lock();
  redirect("/unlock");
}
