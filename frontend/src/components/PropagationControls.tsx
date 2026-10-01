import type { useWalkthrough } from "../useWalkthrough";
import { walkthroughFrame } from "../walkthrough";

const fmt = (value: number) => value.toFixed(4);

export function PropagationControls({ playback }: { playback: ReturnType<typeof useWalkthrough> }) {
  const { current } = walkthroughFrame(playback.trace, playback.cursor);
  const complete = playback.cursor === playback.trace.length;
  const edge = current?.contribution;
  return (
    <section className="propagation-panel" aria-label="Evaluation walkthrough">
      <div className="playback-toolbar">
        <strong>Evaluation walkthrough</strong>
        <span>Step {playback.cursor} / {playback.trace.length}</span>
        <div className="playback-buttons">
          <button onClick={() => playback.move(playback.cursor - 1)} disabled={playback.cursor === 0}>Previous</button>
          <button onClick={playback.toggle}>{playback.playing ? "Pause" : complete ? "Replay" : "Play"}</button>
          <button onClick={() => playback.move(playback.cursor + 1)} disabled={complete}>Next</button>
          <button onClick={() => playback.move(0)}>Restart</button>
          <button onClick={() => playback.move(playback.trace.length)} disabled={complete}>Skip to results</button>
          <label>Speed <select aria-label="Playback speed" value={playback.speed} onChange={(event) => playback.setSpeed(Number(event.target.value))}>
            <option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option>
          </select></label>
        </div>
      </div>
      <progress max={playback.trace.length} value={playback.cursor} aria-label="Walkthrough progress" />
      <div className="step-calculation" aria-live={playback.playing ? "off" : "polite"}>
        {!current ? <><strong>Ready to initialize source nodes</strong><p>Pending nodes and edges are muted until evaluated.</p></> : edge ? <>
          <strong>Transfer · {edge.source} → {edge.target}</strong>
          <code>Q = S × τ × R_source = {fmt(edge.S)} × {fmt(edge.tau)} × {fmt(edge.R_source)} = {fmt(edge.Q)}</code>
          <p>{edge.Q === 0 ? "Zero contribution: the edge is evaluated but carries no propagated risk." : "This contribution is now available to the downstream node."}</p>
        </> : <>
          <strong>{current.type === "source" ? "Initialize source" : "Aggregate incoming contributions"} · {current.node}</strong>
          <code>{current.type === "source" ? `R = B = ${fmt(current.B)}` : `R = 1 − (1 − B) × ∏(1 − Q) = ${fmt(current.risk)}`}</code>
          {current.type === "aggregate" && <code>B = {fmt(current.B)}; incoming Q: {playback.trace.filter((step) => step.type === "transfer" && step.node === current.node).map((step) => fmt(step.contribution!.Q)).join(", ")}</code>}
        </>}
      </div>
      <p className="walkthrough-note">{complete ? "Complete · final results revealed. " : ""}Topological calculation order—not physical travel time.{playback.reducedMotion ? " Reduced motion is enabled; use Next for manual study." : ""}</p>
    </section>
  );
}
