import { expect, test } from "vitest";
import { WsjfStrategy } from "./wsjf-strategy.js";
import { RiceStrategy } from "./rice-strategy.js";

const now = new Date("2026-03-16");
const items = [
  { id: "sso", title: "Enterprise SSO", estimate: 5, wsjf: { userBusinessValue: 8, timeCriticality: 5, riskReduction: 8 }, rice: { reach: 2000, impact: 2, confidence: 80, effort: 3 } },
  { id: "a11y", title: "a11y pass", estimate: 3, wsjf: { userBusinessValue: 5, timeCriticality: 8, riskReduction: 2 }, rice: { reach: 5000, impact: 1, confidence: 85, effort: 2 } },
];

test("WSJF = (bv+tc+rr)/size, ranked desc, with component breakdown", () => {
  const { result, features } = new WsjfStrategy().rank(items, now);
  // sso: (8+5+8)/5 = 4.2 ; a11y: (5+8+2)/3 = 5.0 -> a11y first
  expect(result[0]!.id).toBe("a11y");
  expect(result[0]!.value).toBeCloseTo(5.0);
  expect(result[1]!.value).toBeCloseTo(4.2);
  expect(result[0]!.components.timeCriticality).toBe(8);
  expect(features).toHaveLength(2);
});

test("RICE = (reach*impact*confidence/100)/effort, ranked desc", () => {
  const { result } = new RiceStrategy().rank(items, now);
  // sso: (2000*2*0.8)/3 = 1066.7 ; a11y: (5000*1*0.85)/2 = 2125 -> a11y first
  expect(result[0]!.id).toBe("a11y");
  expect(result[0]!.value).toBeCloseTo(2125);
  expect(result[1]!.value).toBeCloseTo(1066.67, 1);
});

test("WSJF treats missing size as 1 (avoids divide-by-zero)", () => {
  const { result } = new WsjfStrategy().rank([{ id: "x", title: "x", estimate: null, wsjf: { userBusinessValue: 1, timeCriticality: 1, riskReduction: 1 } }], now);
  expect(result[0]!.value).toBeCloseTo(3);
});
