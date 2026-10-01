import { useEffect, useState } from "react";
import type { useWalkthrough } from "../useWalkthrough";
import { walkthroughFrame, type LiveNode } from "../walkthrough";
import { stepMark } from "../timeline";

const fmt = (value: number) => value.toFixed(4);

function runningRisk(node: LiveNode, now: number): number {
  let product = 1;
  for (const edge of node.incoming) {
    const fraction = edge.endAt <= now ? 1 : edge.startAt >= now ? 0 : (now - edge.startAt) / (edge.endAt - edge.startAt);
    product *= 1 - edge.step.contribution!.Q * fraction;
  }
  return 1 - (1 - node.step.B) * product;
}

export function PropagationControls({ playback }: { playback: ReturnType<typeof useWalkthrough> }) {
  const { timeline, clockRef, playing, active, reducedMotion, speed, setSpeed, seek, toggle } = playback;
  const [now, setNow] = useState(() => clockRef.current);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const frame = () => {
      setNow(clockRef.current);
      raf = window.requestAnimationFrame(frame);
    };
    raf = window.requestAnimationFrame(frame);
    return () => window.cancelAnimationFrame(raf);
  }, [active, clockRef]);

  const view = walkthroughFrame(timeline, now);
  const duration = timeline.duration;
  const complete = view.complete;
  const idle = !complete && view.transfers.length === 0 && view.exploring.length === 0;

  return (
    <section className="propagation-panel" aria-label="Evaluation walkthrough">
      <div className="playback-toolbar">
        <strong>Evaluation walkthrough</strong>
        <span>{(now / 1000).toFixed(1)}s / {(duration / 1000).toFixed(1)}s</span>
        <div className="playback-buttons">
          <button onClick={() => seek(stepMark(timeline, now, -1))} disabled={now <= 0}>Previous</button>
          <button onClick={toggle}>{playing ? "Pause" : complete ? "Replay" : "Play"}</button>
          <button onClick={() => seek(stepMark(timeline, now, 1))} disabled={complete}>Next</button>
          <button onClick={() => seek(0)}>Restart</button>
          <button onClick={() => seek(duration)} disabled={complete}>Skip to results</button>
          <label>Speed <select aria-label="Playback speed" value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
            <option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option>
          </select></label>
        </div>
      </div>
      <progress max={duration} value={now} aria-label="Walkthrough progress" />
      <div className="step-calculation" aria-live={playing ? "off" : "polite"}>
        {idle ? <><strong>Ready to initialize source nodes</strong><p>Pending nodes and edges are muted until evaluated.</p></> : complete ? (
          <><strong>Evaluation complete</strong><p>Every node settled; final results are revealed.</p></>
        ) : <>
          <strong>Live evaluation · {view.exploring.length} exploring · {view.transfers.length} in flight</strong>
          {view.transfers.map(({ step, fraction }) => {
            const edge = step.contribution!;
            return (
              <div className="live-step" key={`${edge.source}->${edge.target}`}>
                <strong>Transfer · {edge.source} → {edge.target}</strong>
                <code>Q = S × τ × R_source = {fmt(edge.S)} × {fmt(edge.tau)} × {fmt(edge.R_source)} = {fmt(edge.Q * fraction)}{fraction < 1 ? " · computing" : ""}</code>
                <p>{fraction < 1 ? "Contribution is traveling to the downstream node." : "This contribution is now available to the downstream node."}</p>
              </div>
            );
          })}
          {view.exploring.map((node) => {
            const received = node.incoming.filter((edge) => edge.endAt <= now);
            const inFlight = node.incoming.filter((edge) => edge.startAt <= now && now < edge.endAt).length;
            return (
              <div className="live-step" key={node.step.node}>
                <strong>{node.total === 0 ? "Initialize source" : "Aggregate incoming contributions"} · {node.step.node}{node.total > 0 ? ` · ${received.length}/${node.total} contributions received` : ""}</strong>
                <code>{node.total === 0 ? `R = B = ${fmt(runningRisk(node, now))}` : `R = 1 − (1 − B) × ∏(1 − Q) = ${fmt(runningRisk(node, now))}`}</code>
                <code>B = {fmt(node.step.B)}; received Q: {received.length ? received.map((edge) => fmt(edge.step.contribution!.Q)).join(", ") : "none"}{inFlight > 0 ? `; in flight: ${inFlight}` : ""}</code>
              </div>
            );
          })}
        </>}
      </div>
      <p className="walkthrough-note">{complete ? "Complete · final results revealed. " : ""}Live calculation order—not physical travel time. Independent branches progress in parallel as contributions arrive.{reducedMotion ? " Reduced motion is enabled; use Next for manual study." : ""}</p>
    </section>
  );
}
