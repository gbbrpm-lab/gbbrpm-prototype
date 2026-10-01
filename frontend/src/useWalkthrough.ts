import { useCallback, useEffect, useReducer, useState } from "react";
import type { EvaluationStep } from "./types";
import { emptyWalkthrough, walkthroughReducer } from "./walkthrough";

export function useWalkthrough() {
  const [state, dispatch] = useReducer(walkthroughReducer, emptyWalkthrough);
  const [speed, setSpeed] = useState(1);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);
    const update = () => setReducedMotion(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!state.playing) return;
    const timer = window.setTimeout(() => dispatch({ type: "move", cursor: state.cursor + 1 }), 1200 / speed);
    return () => window.clearTimeout(timer);
  }, [state.playing, state.cursor, speed]);
  const start = useCallback((trace: EvaluationStep[], play = true) => {
    dispatch({ type: "start", trace, play });
  }, []);
  const cancel = useCallback(() => dispatch({ type: "cancel" }), []);
  const move = (cursor: number) => {
    // Manual navigation always pauses so a timer cannot override the chosen step.
    dispatch({ type: "start", trace: state.trace, play: false });
    dispatch({ type: "move", cursor });
  };
  return { ...state, speed, setSpeed, reducedMotion, start, cancel, move,
    toggle: () => dispatch({ type: "toggle" }) };
}
