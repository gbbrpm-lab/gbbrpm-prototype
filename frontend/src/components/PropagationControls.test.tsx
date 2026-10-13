import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PropagationControls } from "./PropagationControls";
import type { useWalkthrough } from "../useWalkthrough";
import { buildTimeline } from "../timeline";
import { PANEL_HEIGHT_DEFAULT } from "../panelSize";
import type { EvaluationStep } from "../types";

function playback(overrides: Partial<ReturnType<typeof useWalkthrough>> = {}): ReturnType<typeof useWalkthrough> {
  return { active: true, trace: [], timeline: buildTimeline([]), time: 0, playing: false,
    clockRef: { current: 0 }, speed: 1, reducedMotion: false, start: () => {}, cancel: () => {},
    seek: () => {}, toggle: () => {}, setSpeed: () => {}, ...overrides };
}

function render(overrides: Partial<ReturnType<typeof useWalkthrough>>, height = PANEL_HEIGHT_DEFAULT) {
  return renderToStaticMarkup(
    <PropagationControls playback={playback(overrides)} height={height} onHeightChange={() => {}} />,
  );
}

const trace: EvaluationStep[] = [
  { type: "source", node: "A", B: 0.8, risk: 0.8 },
  { type: "transfer", node: "B", B: 0.3, risk: 0.58,
    contribution: { source: "A", target: "B", S: 0.5, tau: 1, R_source: 0.8, Q: 0.4 } },
  { type: "aggregate", node: "B", B: 0.3, risk: 0.58 },
];
const timeline = buildTimeline(trace);

describe("walkthrough calculation panel", () => {
  it("ticks the contribution and the aggregate live while the pulse travels", () => {
    const html = render({ trace, timeline, clockRef: { current: 850 } });
    expect(html).toContain("Q = S × τ × R_source = 0.5000 × 1.0000 × 0.8000 = 0.2000 · computing");
    expect(html).toContain("R = 1 − (1 − B) × ∏(1 − Q) = 0.4400");
    expect(html).toContain("Aggregate incoming contributions · B · 0/1 contributions received");
    expect(html).toContain('value="850"');
    expect(html).toContain("1 exploring · 1 in flight");
  });
  it("shows the backend value once every contribution has arrived", () => {
    const html = render({ trace, timeline, clockRef: { current: 1400 } });
    expect(html).toContain("R = 1 − (1 − B) × ∏(1 − Q) = 0.5800");
    expect(html).toContain("1/1 contributions received");
    expect(html).toContain("received Q: 0.4000");
    expect(html).not.toContain("computing");
  });
  it("reports completion with the final results revealed", () => {
    const html = render({ trace, timeline, clockRef: { current: timeline.duration } });
    expect(html).toContain("Every node settled");
    expect(html).toContain("Complete · final results revealed.");
    expect(html).toContain("not physical travel time");
  });
  it("explains source initialization and reduced motion", () => {
    const html = render({ trace, timeline, clockRef: { current: 0 }, reducedMotion: true });
    expect(html).toContain("Initialize source · A");
    expect(html).toContain("R = B = 0.8000");
    expect(html).toContain("Reduced motion is enabled");
    expect(html).toContain("0.0s / 2.1s");
  });
  it("exposes a keyboard-draggable resize handle bound to the panel height", () => {
    const html = render({ trace, timeline, clockRef: { current: 850 } }, 360);
    expect(html).toContain('role="separator"');
    expect(html).toContain('aria-orientation="horizontal"');
    expect(html).toContain('aria-controls="walkthrough-panel"');
    expect(html).toContain('aria-valuenow="360"');
    expect(html).toContain('aria-valuemin="120"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('style="height:360px"');
    expect(html).toContain("Maximize walkthrough height");
  });
});
