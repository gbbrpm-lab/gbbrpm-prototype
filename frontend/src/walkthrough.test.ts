import { describe, expect, it } from "vitest";
import type { EvaluationStep } from "./types";
import { emptyWalkthrough, walkthroughFrame, walkthroughReducer } from "./walkthrough";

const trace: EvaluationStep[] = [
  { type: "source", node: "A", B: 0.8, risk: 0.8 },
  { type: "source", node: "B", B: 0.5, risk: 0.5 },
  { type: "transfer", node: "C", B: 0.1, risk: 0.46,
    contribution: { source: "A", target: "C", S: 0.5, tau: 1, R_source: 0.8, Q: 0.4 } },
  { type: "transfer", node: "C", B: 0.1, risk: 0.46,
    contribution: { source: "B", target: "C", S: 0, tau: 1, R_source: 0.5, Q: 0 } },
  { type: "aggregate", node: "C", B: 0.1, risk: 0.46 },
];

describe("evaluation walkthrough", () => {
  it("does not reveal convergence until every incoming contribution has landed", () => {
    const { timeline } = walkthroughReducer(emptyWalkthrough, { type: "start", trace, play: false });
    expect(walkthroughFrame(timeline, 0).revealedNodes.size).toBe(0);
    const partial = walkthroughFrame(timeline, 1250);
    expect(partial.revealedEdges.has("A->C")).toBe(true);
    expect(partial.revealedEdges.has("B->C")).toBe(false);
    expect(partial.revealedNodes.has("C")).toBe(false);
    expect(partial.revealedNodes.has("A")).toBe(true);
    expect(partial.revealedNodes.has("B")).toBe(true);
    const settled = walkthroughFrame(timeline, 1810);
    expect(settled.revealedNodes.has("C")).toBe(true);
    expect(settled.revealedEdges.size).toBe(2);
  });
  it("keeps independent branches live at the same moment", () => {
    const { timeline } = walkthroughReducer(emptyWalkthrough, { type: "start", trace, play: false });
    const frame = walkthroughFrame(timeline, 550);
    expect(frame.activeNodes.has("B")).toBe(true);
    expect(frame.activeNodes.has("C")).toBe(true);
    expect(frame.revealedNodes.has("A")).toBe(true);
    expect(frame.transfers.map((item) => item.step.contribution!.source)).toEqual(["A"]);
    expect(frame.exploring.map((item) => item.step.node)).toEqual(["B", "C"]);
    expect(frame.complete).toBe(false);
  });
  it("runs, pauses, seeks, replays, and cancels on the clock", () => {
    let state = walkthroughReducer(emptyWalkthrough, { type: "start", trace, play: true });
    expect(state.playing).toBe(true);
    expect(state.time).toBe(0);
    state = walkthroughReducer(state, { type: "tick", time: 1000 });
    expect(state.time).toBe(1000);
    expect(state.playing).toBe(true);
    state = walkthroughReducer(state, { type: "seek", time: 400 });
    expect(state.time).toBe(400);
    expect(state.playing).toBe(false);
    state = walkthroughReducer(state, { type: "toggle" });
    expect(state.playing).toBe(true);
    state = walkthroughReducer(state, { type: "tick", time: 99999 });
    expect(state.time).toBe(state.timeline.duration);
    expect(state.playing).toBe(false);
    expect(walkthroughFrame(state.timeline, state.time).complete).toBe(true);
    state = walkthroughReducer(state, { type: "toggle" });
    expect(state.time).toBe(0);
    expect(state.playing).toBe(true);
    expect(walkthroughReducer(state, { type: "cancel" })).toEqual(emptyWalkthrough);
  });
  it("supports manual reduced-motion startup and empty traces", () => {
    expect(walkthroughReducer(emptyWalkthrough, { type: "start", trace, play: false }).playing).toBe(false);
    expect(walkthroughReducer(emptyWalkthrough, { type: "start", trace: [], play: true }).active).toBe(false);
    expect(walkthroughReducer(emptyWalkthrough, { type: "start", trace: [], play: true }).timeline.duration).toBe(0);
  });
  it("never mutates the input trace", () => {
    const original = structuredClone(trace);
    walkthroughReducer(emptyWalkthrough, { type: "start", trace, play: true });
    expect(trace).toEqual(original);
  });
});
