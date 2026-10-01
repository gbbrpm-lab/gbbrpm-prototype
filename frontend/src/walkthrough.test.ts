import { describe, expect, it } from "vitest";
import type { EvaluationStep } from "./types";
import { emptyWalkthrough, walkthroughBatches, walkthroughFrame, walkthroughReducer } from "./walkthrough";

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

  it("initializes independent sources and transfers their outgoing edges together", () => {
    const batches = walkthroughBatches(trace, "simultaneous");
    expect(batches.map((batch) => batch.map((step) => step.type))).toEqual([
      ["source", "source"], ["transfer", "transfer"], ["aggregate"],
    ]);
    expect(walkthroughFrame(trace, 2, "simultaneous").revealedNodes.has("C")).toBe(false);
    expect(walkthroughFrame(trace, 2, "simultaneous").revealedEdges.size).toBe(2);
    expect(walkthroughFrame(trace, 3, "simultaneous").revealedNodes.has("C")).toBe(true);
  });

  it("allows an early contribution to arrive without waiting for the longer branch", () => {
    const source = (node: string): EvaluationStep => ({ type: "source", node, B: 0.8, risk: 0.8 });
    const aggregate = (node: string): EvaluationStep => ({ type: "aggregate", node, B: 0, risk: 0.4 });
    const transfer = (from: string, to: string): EvaluationStep => ({
      type: "transfer", node: to, B: 0, risk: 0.4,
      contribution: { source: from, target: to, S: 0.5, tau: 1, R_source: 0.8, Q: 0.4 },
    });
    const uneven = [source("A"), transfer("A", "B"), aggregate("B"),
      transfer("B", "C"), aggregate("C"),
      transfer("A", "Z"), transfer("C", "Z"), aggregate("Z")];
    const original = structuredClone(uneven);
    const batches = walkthroughBatches(uneven, "simultaneous");
    const tick = (type: string, node: string, from?: string) => batches.findIndex((batch) => batch.some((step) =>
      step.type === type && step.node === node && (!from || step.contribution?.source === from)));
    expect(tick("transfer", "Z", "A")).toBe(tick("transfer", "B", "A"));
    expect(tick("transfer", "Z", "A")).toBeLessThan(tick("aggregate", "C"));
    expect(tick("aggregate", "Z")).toBeGreaterThan(tick("transfer", "Z", "C"));
    expect(walkthroughFrame(uneven, tick("aggregate", "C") + 1, "simultaneous").revealedNodes.has("Z")).toBe(false);
    const final = walkthroughFrame(uneven, batches.length, "simultaneous");
    expect(final.revealedNodes).toEqual(walkthroughFrame(uneven, uneven.length).revealedNodes);
    expect(final.revealedEdges).toEqual(walkthroughFrame(uneven, uneven.length).revealedEdges);
    expect(batches.flat()).toHaveLength(uneven.length);
    expect(new Set(batches.flat()).size).toBe(uneven.length);
    expect(uneven).toEqual(original);
  });

  it("uses simultaneous frame count for skip, replay, previous, and reduced-motion startup", () => {
    let state = walkthroughReducer(emptyWalkthrough, { type: "start", trace, play: false, mode: "simultaneous" });
    expect(state.batches).toHaveLength(3);
    expect(state.playing).toBe(false);
    state = walkthroughReducer(state, { type: "move", cursor: 999 });
    expect(state.cursor).toBe(3);
    state = walkthroughReducer(state, { type: "toggle" });
    expect(state.cursor).toBe(0);
    expect(state.playing).toBe(true);
    state = walkthroughReducer(state, { type: "move", cursor: 3 });
    expect(state.playing).toBe(false);
    state = walkthroughReducer(state, { type: "move", cursor: 2 });
    expect(walkthroughFrame(trace, state.cursor, "simultaneous").revealedNodes.has("C")).toBe(false);
  });
});
