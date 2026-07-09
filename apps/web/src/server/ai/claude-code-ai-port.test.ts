import { expect, test } from "vitest";
import { ClaudeCodeAIPort, extractCliResult } from "./claude-code-ai-port.js";
import { TemplateAIPort } from "./template-ai-port.js";
import { DailyBriefComposeOutput } from "@pma/contracts";

const briefInput = {
  date: "2026-03-16",
  manager_name: "Alex",
  suggested_actions: [
    { id: "a1", type: "sprint_end", urgency: "high", text: "Sprint 14 ends Fri", refs: ["s14"] },
    { id: "a2", type: "one_on_one_overdue", urgency: "med", text: "Meet Lin", refs: ["lin"] },
  ],
};

const validOutput = JSON.stringify({
  headline: "Two items today, one urgent.",
  ranked_action_ids: ["a1", "a2"],
  tips: ["Close Sprint 14 first."],
  grounded_on: ["a1", "a2", "2026-03-16"],
  confidence: 0.6,
});

/** A ClaudeCodeAIPort whose CLI runner returns fixed stdout, or throws. */
function portReturning(stdout: string | (() => never)): ClaudeCodeAIPort {
  return new ClaudeCodeAIPort(new TemplateAIPort(), async () => {
    if (typeof stdout === "function") stdout();
    return stdout as string;
  });
}

test("extractCliResult unwraps the --output-format json envelope", () => {
  expect(extractCliResult(JSON.stringify({ type: "result", result: "hello" }))).toBe("hello");
});

test("extractCliResult falls back to raw stdout when not the envelope", () => {
  expect(extractCliResult("not json at all")).toBe("not json at all");
});

test("a valid Claude Code result validates against the contract", async () => {
  const port = portReturning(JSON.stringify({ type: "result", result: validOutput }));
  const res = await port.run("daily-brief.compose", briefInput);
  expect((res.output as { headline: string }).headline).toBe("Two items today, one urgent.");
  expect(res.groundedOn).toEqual(["a1", "a2", "2026-03-16"]);
  expect(
    DailyBriefComposeOutput.safeParse({ ...(res.output as object), grounded_on: res.groundedOn, confidence: res.confidence }).success,
  ).toBe(true);
});

test("a bare (non-enveloped) JSON result is still accepted", async () => {
  const port = portReturning(validOutput);
  const res = await port.run("daily-brief.compose", briefInput);
  expect((res.output as { headline: string }).headline).toBe("Two items today, one urgent.");
});

test("a CLI failure falls back to the deterministic template", async () => {
  const port = portReturning(() => {
    throw new Error("claude exited 1: not logged in");
  });
  const res = await port.run("daily-brief.compose", briefInput);
  const template = await new TemplateAIPort().run("daily-brief.compose", briefInput);
  expect(res).toEqual(template);
});

test("garbage CLI output falls back to the template", async () => {
  const port = portReturning(JSON.stringify({ type: "result", result: "sorry, no json" }));
  const res = await port.run("daily-brief.compose", briefInput);
  const template = await new TemplateAIPort().run("daily-brief.compose", briefInput);
  expect(res).toEqual(template);
});

test("an unsupported task is delegated to the fallback (which rejects it)", async () => {
  const port = portReturning(validOutput);
  await expect(port.run("nope.task", {})).rejects.toThrow(/unsupported/);
});
