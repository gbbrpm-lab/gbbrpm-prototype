import type { useWalkthrough } from "../useWalkthrough";
import { walkthroughBatches, walkthroughFrame } from "../walkthrough";

const fmt = (value: number) => value.toFixed(4);

export function PropagationControls({ playback }: { playback: ReturnType<typeof useWalkthrough> }) {
  const { currents } = walkthroughFrame(playback.trace, playback.cursor, playback.mode);
  const total = walkthroughBatches(playback.trace, playback.mode).length;
  const complete = playback.cursor === total;
  return (
    <section className="propagation-panel" aria-label="Evaluation walkthrough">
      <div className="playback-toolbar">
        <strong>Evaluation walkthrough</strong>
        <span>{playback.mode === "simultaneous" ? "Frame" : "Step"} {playback.cursor} / {total}</span>
        {playback.mode === "simultaneous" && <span>{currents.length} event{currents.length === 1 ? "" : "s"} together</span>}
        <div className="playback-buttons">
          <button onClick={() => playback.move(playback.cursor - 1)} disabled={playback.cursor === 0}>Previous</button>
          <button onClick={playback.toggle}>{playback.playing ? "Pause" : complete ? "Replay" : "Play"}</button>
          <button onClick={() => playback.move(playback.cursor + 1)} disabled={complete}>Next</button>
          <button onClick={() => playback.move(0)}>Restart</button>
          <button onClick={() => playback.move(total)} disabled={complete}>Skip to results</button>
          <label>Speed <select aria-label="Playback speed" value={playback.speed} onChange={(event) => playback.setSpeed(Number(event.target.value))}>
            <option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option>
          </select></label>
        </div>
      </div>
      <progress max={total} value={playback.cursor} aria-label="Walkthrough progress" />
      <div className="step-calculation" aria-live={playback.playing ? "off" : "polite"}>
        {!currents.length && <><strong>Ready to initialize source nodes</strong><p>Pending nodes and edges are muted until evaluated.</p></>}
        {currents.map((current) => {
          const edge = current.contribution;
          return <article className="step-event" key={edge ? `${edge.source}->${edge.target}` : current.node}>{edge ? <>
          <strong>Transfer · {edge.source} → {edge.target}</strong>
          <code>Q = S × τ × R_source = {fmt(edge.S)} × {fmt(edge.tau)} × {fmt(edge.R_source)} = {fmt(edge.Q)}</code>
          <p>{edge.Q === 0 ? "Zero contribution: the edge is evaluated but carries no propagated risk." : "This contribution is now available to the downstream node."}</p>
        </> : <>
          <strong>{current.type === "source" ? "Initialize source" : "Aggregate incoming contributions"} · {current.node}</strong>
          <code>{current.type === "source" ? `R = B = ${fmt(current.B)}` : `R = 1 − (1 − B) × ∏(1 − Q) = ${fmt(current.risk)}`}</code>
          {current.type === "aggregate" && <code>B = {fmt(current.B)}; incoming Q: {playback.trace.filter((step) => step.type === "transfer" && step.node === current.node).map((step) => fmt(step.contribution!.Q)).join(", ")}</code>}
        </>}</article>;
        })}
      </div>
      <p className="walkthrough-note">{complete ? "Complete · final results revealed. " : ""}Topological calculation order—not physical travel time.{playback.mode === "simultaneous" ? " Branches advance when ready; convergence waits for every incoming contribution. Changing mode restarts paused." : ""}{playback.reducedMotion ? " Reduced motion is enabled; use Next for manual study." : ""}</p>
    </section>
  );
}
