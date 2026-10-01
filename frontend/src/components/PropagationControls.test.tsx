import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PropagationControls } from "./PropagationControls";
import type { useWalkthrough } from "../useWalkthrough";

function playback(overrides: Partial<ReturnType<typeof useWalkthrough>> = {}): ReturnType<typeof useWalkthrough> {
  return { active: true, trace: [], batches: [], mode: "step", setMode: () => {}, cursor: 0, playing: false, speed: 1,
    reducedMotion: false, start: () => {}, cancel: () => {}, move: () => {},
    toggle: () => {}, setSpeed: () => {}, ...overrides };
}

describe("walkthrough calculation panel", () => {
  it("renders the actual backend contribution, including explicit S", () => {
    const html = renderToStaticMarkup(<PropagationControls playback={playback({
      trace: [{ type: "transfer", node: "B", B: 0, risk: 0.4,
        contribution: { source: "A", target: "B", S: 0.5, tau: 1, R_source: 0.8, Q: 0.4 } }],
      cursor: 1,
    })} />);
    expect(html).toContain("0.5000 × 1.0000 × 0.8000 = 0.4000");
    expect(html).toContain("not physical travel time");
  });
  it("explains source initialization and reduced motion", () => {
    const html = renderToStaticMarkup(<PropagationControls playback={playback({
      trace: [{ type: "source", node: "A", B: 0.8, risk: 0.8 }], cursor: 1,
      reducedMotion: true,
    })} />);
    expect(html).toContain("R = B = 0.8000");
    expect(html).toContain("Reduced motion is enabled");
  });
  it("lists every incoming Q in the aggregation step", () => {
    const html = renderToStaticMarkup(<PropagationControls playback={playback({
      trace: [
        { type: "transfer", node: "C", B: 0.1, risk: 0.73,
          contribution: { source: "A", target: "C", S: 0.5, tau: 1, R_source: 0.8, Q: 0.4 } },
        { type: "transfer", node: "C", B: 0.1, risk: 0.73,
          contribution: { source: "B", target: "C", S: 1, tau: 1, R_source: 0.5, Q: 0.5 } },
        { type: "aggregate", node: "C", B: 0.1, risk: 0.73 },
      ], cursor: 3,
    })} />);
    expect(html).toContain("0.4000, 0.5000");
    expect(html).toContain("0.7300");
  });

  it("renders all concurrent transfers rather than only the first", () => {
    const html = renderToStaticMarkup(<PropagationControls playback={playback({
      mode: "simultaneous", cursor: 2,
      trace: [
        { type: "source", node: "A", B: 0.8, risk: 0.8 },
        { type: "source", node: "B", B: 0.5, risk: 0.5 },
        { type: "transfer", node: "C", B: 0, risk: 0.7,
          contribution: { source: "A", target: "C", S: 0.5, tau: 1, R_source: 0.8, Q: 0.4 } },
        { type: "transfer", node: "C", B: 0, risk: 0.7,
          contribution: { source: "B", target: "C", S: 1, tau: 1, R_source: 0.5, Q: 0.5 } },
        { type: "aggregate", node: "C", B: 0, risk: 0.7 },
      ],
    })} />);
    expect(html).toContain("Frame 2 / 3");
    expect(html).toContain("2 events together");
    expect(html).toContain("0.5000 × 1.0000 × 0.8000 = 0.4000");
    expect(html).toContain("1.0000 × 1.0000 × 0.5000 = 0.5000");
  });
});
