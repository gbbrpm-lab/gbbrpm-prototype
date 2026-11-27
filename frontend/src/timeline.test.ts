import { describe, expect, it } from "vitest";
import { buildTimeline, stepMark, AGG_MS, HOLD_MS, INIT_MS, STAGGER_MS } from "./timeline";
import type { EvaluationStep } from "./types";

const source = (node: string, B = 0.5): EvaluationStep => ({ type: "source", node, B, risk: B });
const transfer = (from: string, to: string, Q = 0.25): EvaluationStep => ({
  type: "transfer", node: to, B: 0.2, risk: 0.4,
  contribution: { source: from, target: to, S: 0.5, tau: 1, R_source: 0.5, Q },
});
const aggregate = (node: string): EvaluationStep => ({ type: "aggregate", node, B: 0.2, risk: 0.4 });

const diamond: EvaluationStep[] = [
  source("A"),
  transfer("A", "B"), aggregate("B"),
  transfer("A", "C"), aggregate("C"),
  transfer("B", "D"), transfer("C", "D"), aggregate("D"),
];

describe("evaluation timeline", () => {
  it("keeps causality: pulses start after their source settles and nodes settle after their pulses", () => {
    const timeline = buildTimeline(diamond);
    for (const [id, node] of timeline.nodes) {
      expect(id).toBe(node.active!.node);
      for (const edge of node.incoming) {
        expect(edge.startAt).toBeGreaterThanOrEqual(timeline.nodes.get(edge.id.split("->")[0])!.settleAt);
        expect(node.settleAt).toBeGreaterThanOrEqual(edge.endAt);
      }
    }
    expect(timeline.nodes.get("A")!.settleAt - timeline.nodes.get("A")!.activeAt).toBe(INIT_MS);
    expect(timeline.nodes.get("B")!.settleAt - timeline.nodes.get("B")!.incoming[0].endAt).toBe(AGG_MS);
  });
  it("pipelines independent branches instead of running layers", () => {
    const timeline = buildTimeline(diamond);
    const [a, b, c, d] = ["A", "B", "C", "D"].map((id) => timeline.nodes.get(id)!);
    expect(b.activeAt).toBe(INIT_MS);
    expect(c.activeAt).toBe(b.activeAt + STAGGER_MS);
    expect(c.activeAt).toBeLessThan(b.settleAt);
    expect(d.activeAt).toBe(b.settleAt);
    expect(d.activeAt).toBeLessThan(c.settleAt);
    expect(timeline.duration).toBe(d.settleAt + HOLD_MS);
  });
  it("exposes strictly increasing marks from zero to the duration", () => {
    const timeline = buildTimeline(diamond);
    expect(timeline.marks[0]).toBe(0);
    expect(timeline.marks[timeline.marks.length - 1]).toBe(timeline.duration);
    for (let index = 1; index < timeline.marks.length; index += 1) {
      expect(timeline.marks[index]).toBeGreaterThan(timeline.marks[index - 1]);
    }
    expect(timeline.marks.length).toBeGreaterThan(6);
  });
  it("is deterministic and never mutates the input trace", () => {
    const original = structuredClone(diamond);
    expect(buildTimeline(diamond)).toEqual(buildTimeline(diamond));
    expect(diamond).toEqual(original);
  });
  it("navigates to neighbouring marks in both directions", () => {
    const timeline = buildTimeline(diamond);
    expect(stepMark(timeline, 0, -1)).toBe(0);
    expect(stepMark(timeline, 0, 1)).toBeGreaterThan(0);
    expect(stepMark(timeline, timeline.duration, 1)).toBe(timeline.duration);
    const previous = stepMark(timeline, timeline.duration, -1);
    expect(previous).toBeGreaterThan(0);
    expect(previous).toBeLessThan(timeline.duration);
    expect(stepMark(timeline, previous + 1, -1)).toBe(previous);
  });
  it("schedules a single source as initialize then hold", () => {
    const timeline = buildTimeline([source("A")]);
    expect(timeline.nodes.get("A")!.settleAt).toBe(INIT_MS);
    expect(timeline.duration).toBe(INIT_MS + HOLD_MS);
  });
});
