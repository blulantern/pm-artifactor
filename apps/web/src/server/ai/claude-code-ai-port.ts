import { spawn } from "node:child_process";
import type { AIPort } from "@pma/core";
import { GroundedLLMPort } from "./grounded-llm-port.js";

/** Runs a headless Claude Code prompt and returns raw stdout. Injectable for tests. */
export type ClaudeCliRunner = (prompt: string) => Promise<string>;

/**
 * Claude Code adapter for the generative tail — routes AI through your logged-in
 * Claude Code CLI (subscription) instead of a metered API key. Intended for local
 * exploration/testing, NOT for shipping: it shells out to `claude` per task and
 * depends on an interactive Claude Code login.
 *
 * Like ClaudeAIPort it only implements `complete()`; the shared GroundedLLMPort base
 * does contract validation, grounding, and the deterministic fallback.
 */
export class ClaudeCodeAIPort extends GroundedLLMPort {
  constructor(
    fallback: AIPort,
    private readonly runCli: ClaudeCliRunner = runClaudeCli,
    model = "claude-code",
  ) {
    super(fallback, model);
  }

  protected async complete(system: string, user: string): Promise<string> {
    const stdout = await this.runCli(`${system}\n\n${user}`);
    return extractCliResult(stdout);
  }
}

/**
 * Pulls the assistant's final text out of Claude Code's `--output-format json`
 * envelope ({ ..., "result": "<text>" }). Falls back to treating stdout as the
 * text itself if the shape differs — the base's contract validation is the real gate.
 */
export function extractCliResult(stdout: string): string {
  try {
    const parsed = JSON.parse(stdout) as { result?: unknown };
    if (parsed && typeof parsed.result === "string") return parsed.result;
  } catch {
    // not the JSON envelope — fall through to raw stdout
  }
  return stdout;
}

/** Default runner: `claude -p --output-format json`, prompt on stdin, using the logged-in session. */
function runClaudeCli(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", ["-p", "--output-format", "json"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(out) : reject(new Error(`claude exited ${code}: ${err.trim()}`)),
    );
    child.stdin.write(prompt);
    child.stdin.end();
  });
}
