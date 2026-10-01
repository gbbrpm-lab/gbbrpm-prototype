import type { EvaluationStep } from "./types";

export interface WalkthroughState {
  trace: EvaluationStep[];
  cursor: number;
  playing: boolean;
  active: boolean;
}

export const emptyWalkthrough: WalkthroughState = {
  trace: [], cursor: 0, playing: false, active: false,
};

export type WalkthroughAction =
  | { type: "start"; trace: EvaluationStep[]; play: boolean }
  | { type: "cancel" }
  | { type: "move"; cursor: number }
  | { type: "toggle" };

export function walkthroughReducer(state: WalkthroughState, action: WalkthroughAction): WalkthroughState {
  if (action.type === "cancel") return emptyWalkthrough;
  if (action.type === "start") return {
    trace: action.trace, cursor: 0,
    active: action.trace.length > 0,
    playing: action.play && action.trace.length > 0,
  };
  if (action.type === "toggle") return {
    ...state,
    cursor: state.cursor === state.trace.length ? 0 : state.cursor,
    playing: !state.playing,
  };
  const cursor = Math.max(0, Math.min(action.cursor, state.trace.length));
  return { ...state, cursor, playing: state.playing && cursor < state.trace.length };
}

export function walkthroughFrame(trace: EvaluationStep[], cursor: number) {
  const revealedNodes = new Set<string>();
  const revealedEdges = new Set<string>();
  for (const step of trace.slice(0, cursor)) {
    if (step.type === "transfer" && step.contribution) {
      revealedEdges.add(`${step.contribution.source}->${step.contribution.target}`);
    } else revealedNodes.add(step.node);
  }
  return { revealedNodes, revealedEdges, current: cursor > 0 ? trace[cursor - 1] : null };
}
