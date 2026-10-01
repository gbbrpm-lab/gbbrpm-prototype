import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { EvaluationStep } from "./types";
import { emptyWalkthrough, walkthroughReducer } from "./walkthrough";

export function useWalkthrough() {
  const [state, dispatch] = useReducer(walkthroughReducer, emptyWalkthrough);
  const [speed, setSpeed] = useState(1);
  const [reducedMotion, setReducedMotion] = useState(false);
  const clockRef = useRef(0);
  const markRef = useRef(0);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);
    const update = () => setReducedMotion(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => { clockRef.current = state.time; }, [state.time]);

  useEffect(() => {
    if (!state.playing || state.timeline.duration === 0) return;
    const { marks, duration } = state.timeline;
    markRef.current = marks.reduce((index, mark, position) => (mark <= state.time ? position : index), 0);
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      clockRef.current = Math.min(clockRef.current + (now - last) * speed, duration);
      last = now;
      let index = markRef.current;
      while (index + 1 < marks.length && marks[index + 1] <= clockRef.current) index += 1;
      if (index !== markRef.current) {
        markRef.current = index;
        dispatch({ type: "tick", time: marks[index] });
      }
      if (clockRef.current < duration) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [state.playing, state.time, state.timeline, speed]);

  const start = useCallback((trace: EvaluationStep[], play = true) => {
    dispatch({ type: "start", trace, play });
  }, []);
  const cancel = useCallback(() => dispatch({ type: "cancel" }), []);
  const seek = useCallback((time: number) => dispatch({ type: "seek", time }), []);

  return {
    ...state,
    clockRef,
    speed,
    setSpeed,
    reducedMotion,
    start,
    cancel,
    seek,
    toggle: () => dispatch({ type: "toggle" }),
  };
}
