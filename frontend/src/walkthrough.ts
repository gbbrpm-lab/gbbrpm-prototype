import type { EvaluationStep } from "./types";
import { buildTimeline, emptyTimeline, type EdgeSchedule, type Timeline } from "./timeline";

export interface WalkthroughState {
  trace: EvaluationStep[];
  timeline: Timeline;
  time: number;
  playing: boolean;
  active: boolean;
}

export const emptyWalkthrough: WalkthroughState = {
  trace: [], timeline: emptyTimeline(), time: 0, playing: false, active: false,
};

export type WalkthroughAction =
  | { type: "start"; trace: EvaluationStep[]; play: boolean }
  | { type: "tick"; time: number }
  | { type: "seek"; time: number }
  | { type: "toggle" }
  | { type: "cancel" };

export interface LiveStep {
  step: EvaluationStep;
  fraction: number;
}

export interface LiveNode {
  step: EvaluationStep;
  fraction: number;
  received: number;
  total: number;
  incoming: EdgeSchedule[];
}

export interface WalkthroughFrame {
  revealedNodes: Set<string>;
  revealedEdges: Set<string>;
  activeNodes: Set<string>;
  activeEdges: Set<string>;
  transfers: LiveStep[];
  exploring: LiveNode[];
  complete: boolean;
}

const clamp = (time: number, duration: number) => Math.max(0, Math.min(time, duration));

export function walkthroughReducer(state: WalkthroughState, action: WalkthroughAction): WalkthroughState {
  if (action.type === "cancel") return emptyWalkthrough;
  if (action.type === "start") {
    const timeline = buildTimeline(action.trace);
    return {
      trace: action.trace,
      timeline,
      time: 0,
      active: action.trace.length > 0,
      playing: action.play && action.trace.length > 0,
    };
  }
  if (action.type === "tick") {
    const time = clamp(action.time, state.timeline.duration);
    return { ...state, time, playing: state.playing && time < state.timeline.duration };
  }
  if (action.type === "seek") {
    return { ...state, time: clamp(action.time, state.timeline.duration), playing: false };
  }
  if (!state.active) return state;
  const atEnd = state.time >= state.timeline.duration;
  return { ...state, time: atEnd ? 0 : state.time, playing: atEnd ? true : !state.playing };
}

export function walkthroughFrame(timeline: Timeline, time: number): WalkthroughFrame {
  const revealedNodes = new Set<string>();
  const revealedEdges = new Set<string>();
  const activeNodes = new Set<string>();
  const activeEdges = new Set<string>();
  const transfers: LiveStep[] = [];
  const exploring: LiveNode[] = [];

  for (const [id, edge] of timeline.edges) {
    if (edge.endAt <= time) {
      revealedEdges.add(id);
    } else if (edge.startAt <= time) {
      activeEdges.add(id);
      activeNodes.add(edge.step.contribution!.source);
      transfers.push({ step: edge.step, fraction: (time - edge.startAt) / (edge.endAt - edge.startAt) });
    }
  }
  for (const [id, node] of timeline.nodes) {
    if (node.settleAt <= time) {
      revealedNodes.add(id);
      continue;
    }
    if (node.activeAt > time) continue;
    activeNodes.add(id);
    exploring.push({
      step: node.active!,
      fraction: (time - node.activeAt) / (node.settleAt - node.activeAt),
      received: node.incoming.filter((edge) => edge.endAt <= time).length,
      total: node.incoming.length,
      incoming: node.incoming,
    });
  }

  return {
    revealedNodes,
    revealedEdges,
    activeNodes,
    activeEdges,
    transfers,
    exploring,
    complete: timeline.duration > 0 && time >= timeline.duration,
  };
}
