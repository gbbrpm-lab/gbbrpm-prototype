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
  it("does not reveal convergence until every incoming transfer is shown", () => {
    expect(walkthroughFrame(trace, 0).revealedNodes.size).toBe(0);
    expect(walkthroughFrame(trace, 3).revealedNodes.has("C")).toBe(false);
    expect(walkthroughFrame(trace, 4).revealedNodes.has("C")).toBe(false);
    expect(walkthroughFrame(trace, 5).revealedNodes.has("C")).toBe(true);
    expect(walkthroughFrame(trace, 4).revealedEdges.has("B->C")).toBe(true);
  });
  it("pauses, resumes, skips, restarts, and cancels without changing results", () => {
    const original = structuredClone(trace);
    let state = walkthroughReducer(emptyWalkthrough, { type: "start", trace, play: true });
    state = walkthroughReducer(state, { type: "move", cursor: 2 });
    state = walkthroughReducer(state, { type: "toggle" });
    expect(state.playing).toBe(false);
    expect(state.cursor).toBe(2);
    state = walkthroughReducer(state, { type: "toggle" });
    expect(state.playing).toBe(true);
    state = walkthroughReducer(state, { type: "move", cursor: 999 });
    expect(state.cursor).toBe(trace.length);
    expect(state.playing).toBe(false);
    expect(walkthroughFrame(trace, state.cursor).revealedNodes.size).toBe(3);
    state = walkthroughReducer(state, { type: "toggle" });
    expect(state.cursor).toBe(0);
    expect(state.playing).toBe(true);
    state = walkthroughReducer(state, { type: "move", cursor: -1 });
    expect(state.cursor).toBe(0);
    expect(walkthroughReducer(state, { type: "cancel" })).toEqual(emptyWalkthrough);
    expect(trace).toEqual(original);
  });
  it("supports manual reduced-motion startup and empty traces", () => {
    expect(walkthroughReducer(emptyWalkthrough, { type: "start", trace, play: false }).playing).toBe(false);
    expect(walkthroughReducer(emptyWalkthrough, { type: "start", trace: [], play: true }).active).toBe(false);
  });
});
