/**
 * OAuth redirect target. A Route Handler, not a server action, because Atlassian
 * redirects the browser here with query params. Registered callback (the only
 * one an app may have): http://localhost:3000/api/atlassian/callback
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/server/db";
import { completeConnect } from "@/server/integrations/atlassian/connect-service";

export const dynamic = "force-dynamic";

const back = (req: NextRequest, params: Record<string, string>) =>
  NextResponse.redirect(new URL(`/connections?${new URLSearchParams(params)}`, req.url));

export async function GET(req: NextRequest): Promise<NextResponse> {
  const q = req.nextUrl.searchParams;

  // Atlassian reports user-denied consent here — surface it, don't treat it as a bug.
  const denied = q.get("error");
  if (denied) return back(req, { error: q.get("error_description") ?? denied });

  const code = q.get("code");
  const state = q.get("state");
  if (!code || !state) return back(req, { error: "Atlassian callback was missing its code or state." });

  try {
    const { chosen } = await completeConnect(db(), code, state);
    return chosen ? back(req, { connected: chosen.siteName }) : back(req, { choose: "1" });
  } catch (e) {
    return back(req, { error: e instanceof Error ? e.message : "Could not complete the Atlassian connection." });
  }
}
