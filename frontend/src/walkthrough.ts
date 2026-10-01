import type { EvaluationStep } from "./types";

export type PlaybackMode = "step" | "simultaneous";

/** Schedule each event at its earliest dependency-ready tick.
 * Ticks are presentation timing only; model values are never recomputed.
 */
export function walkthroughBatches(trace: EvaluationStep[], mode: PlaybackMode): EvaluationStep[][] {
  if (mode === "step") return trace.map((step) => [step]);
  const readyAt = new Map<string, number>();
  const incomingAt = new Map<string, number[]>();
  const batches = new Map<number, EvaluationStep[]>();
  for (const step of trace) {
    let tick = 0;
    if (step.type === "transfer" && step.contribution) {
      const sourceTick = readyAt.get(step.contribution.source);
      if (sourceTick === undefined) throw new Error("Trace transfer precedes source evaluation");
      tick = sourceTick + 1;
      incomingAt.set(step.node, [...(incomingAt.get(step.node) ?? []), tick]);
    } else {
      const incoming = incomingAt.get(step.node) ?? [];
      tick = incoming.length ? Math.max(...incoming) + 1 : 0;
      readyAt.set(step.node, tick);
    }
    batches.set(tick, [...(batches.get(tick) ?? []), step]);
  }
  return [...batches.entries()].sort(([a], [b]) => a - b).map(([, steps]) => steps);
}

export interface WalkthroughState {
  trace: EvaluationStep[];
  batches: EvaluationStep[][];
  cursor: number;
  playing: boolean;
  active: boolean;
}

export const emptyWalkthrough: WalkthroughState = {
  trace: [], batches: [], cursor: 0, playing: false, active: false,
};

export type WalkthroughAction =
  | { type: "start"; trace: EvaluationStep[]; play: boolean; mode?: PlaybackMode }
  | { type: "cancel" }
  | { type: "move"; cursor: number }
  | { type: "toggle" };

export function walkthroughReducer(state: WalkthroughState, action: WalkthroughAction): WalkthroughState {
  if (action.type === "cancel") return emptyWalkthrough;
  if (action.type === "start") return {
    trace: action.trace, batches: walkthroughBatches(action.trace, action.mode ?? "step"), cursor: 0,
    active: action.trace.length > 0,
    playing: action.play && action.trace.length > 0,
  };
  if (action.type === "toggle") return {
    ...state,
    cursor: state.cursor === state.batches.length ? 0 : state.cursor,
    playing: !state.playing,
  };
  const cursor = Math.max(0, Math.min(action.cursor, state.batches.length));
  return { ...state, cursor, playing: state.playing && cursor < state.batches.length };
}

export function walkthroughFrame(trace: EvaluationStep[], cursor: number, mode: PlaybackMode = "step") {
  const batches = walkthroughBatches(trace, mode);
  const revealedNodes = new Set<string>();
  const revealedEdges = new Set<string>();
  for (const step of batches.slice(0, cursor).flat()) {
    if (step.type === "transfer" && step.contribution) {
      revealedEdges.add(`${step.contribution.source}->${step.contribution.target}`);
    } else revealedNodes.add(step.node);
  }
  const currents = cursor > 0 ? batches[cursor - 1] ?? [] : [];
  return { revealedNodes, revealedEdges, currents, current: currents[0] ?? null };
}
