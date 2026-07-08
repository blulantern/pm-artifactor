import { expect, test } from "vitest";
import { legalNextStates } from "./config.js";
import { workflowStateId } from "../shared/ids.js";

const wf = {
  states: [
    { id: workflowStateId("todo"), name: "To Do", category: "todo" as const, order: 0 },
    { id: workflowStateId("doing"), name: "In Progress", category: "in_progress" as const, order: 1 },
    { id: workflowStateId("done"), name: "Done", category: "done" as const, order: 2 },
  ],
  transitions: [
    { fromStateId: workflowStateId("todo"), toStateId: workflowStateId("doing"), name: "start" },
    { fromStateId: workflowStateId("doing"), toStateId: workflowStateId("done"), name: "finish" },
  ],
};

test("legalNextStates returns only reachable states", () => {
  const next = legalNextStates(wf, workflowStateId("todo"));
  expect(next.map((s) => s.name)).toEqual(["In Progress"]);
});
