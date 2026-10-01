import type { EvaluationStep } from "./types";

export const PULSE_MS = 700;
export const AGG_MS = 500;
export const INIT_MS = 500;
export const STAGGER_MS = 110;
export const HOLD_MS = 450;

export interface EdgeSchedule {
  id: string;
  startAt: number;
  endAt: number;
  step: EvaluationStep;
}

export interface NodeSchedule {
  activeAt: number;
  settleAt: number;
  active: EvaluationStep | null;
  incoming: EdgeSchedule[];
}

export interface Timeline {
  duration: number;
  marks: number[];
  nodes: Map<string, NodeSchedule>;
  edges: Map<string, EdgeSchedule>;
}

export function emptyTimeline(): Timeline {
  return { duration: 0, marks: [0], nodes: new Map(), edges: new Map() };
}

export function buildTimeline(trace: EvaluationStep[]): Timeline {
  const stepsByNode = new Map<string, EvaluationStep[]>();
  const order: string[] = [];
  for (const step of trace) {
    if (!stepsByNode.has(step.node)) {
      stepsByNode.set(step.node, []);
      order.push(step.node);
    }
    stepsByNode.get(step.node)!.push(step);
  }

  const nodes = new Map<string, NodeSchedule>();
  const edges = new Map<string, EdgeSchedule>();
  const slots = new Map<number, number>();
  const resolving = new Set<string>();

  const offsetFor = (base: number) => {
    const slot = slots.get(base) ?? 0;
    slots.set(base, slot + 1);
    return slot * STAGGER_MS;
  };

  const resolve = (id: string): NodeSchedule => {
    const known = nodes.get(id);
    if (known) return known;
    const steps = stepsByNode.get(id);
    if (!steps) return { activeAt: 0, settleAt: 0, active: null, incoming: [] };
    if (resolving.has(id)) return { activeAt: 0, settleAt: 0, active: null, incoming: [] };

    resolving.add(id);
    const own = steps.find((step) => step.type !== "transfer") ?? steps[steps.length - 1];
    const incomingSteps = steps.filter((step) => step.type === "transfer" && step.contribution);

    let firstArrival = Number.POSITIVE_INFINITY;
    for (const step of incomingSteps) firstArrival = Math.min(firstArrival, resolve(step.contribution!.source).settleAt);
    const hasIncoming = incomingSteps.length > 0;

    const activeAt = (hasIncoming ? firstArrival : 0) + offsetFor(hasIncoming ? firstArrival : 0);
    const incoming: EdgeSchedule[] = [];
    let lastEnd = activeAt;
    for (const step of incomingSteps) {
      const source = resolve(step.contribution!.source);
      const startAt = source.settleAt + (activeAt - firstArrival);
      const endAt = startAt + PULSE_MS;
      const edge: EdgeSchedule = {
        id: `${step.contribution!.source}->${step.contribution!.target}`,
        startAt,
        endAt,
        step,
      };
      edges.set(edge.id, edge);
      incoming.push(edge);
      lastEnd = Math.max(lastEnd, endAt);
    }

    const schedule: NodeSchedule = {
      activeAt,
      settleAt: hasIncoming ? lastEnd + AGG_MS : activeAt + INIT_MS,
      active: own,
      incoming,
    };
    resolving.delete(id);
    nodes.set(id, schedule);
    return schedule;
  };

  for (const id of order) resolve(id);

  const lastSettle = [...nodes.values()].reduce((max, node) => Math.max(max, node.settleAt), 0);
  const duration = nodes.size === 0 ? 0 : lastSettle + HOLD_MS;
  const marks = new Set<number>([0, duration]);
  for (const edge of edges.values()) {
    marks.add(edge.startAt);
    marks.add(edge.endAt);
  }
  for (const node of nodes.values()) {
    marks.add(node.activeAt);
    marks.add(node.settleAt);
  }
  return { duration, marks: [...marks].sort((left, right) => left - right), nodes, edges };
}

export function stepMark(timeline: Timeline, time: number, direction: -1 | 1): number {
  if (direction < 0) {
    let previous = 0;
    for (const mark of timeline.marks) {
      if (mark >= time) break;
      previous = mark;
    }
    return previous;
  }
  for (const mark of timeline.marks) if (mark > time) return mark;
  return timeline.duration;
}
