import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import {
  PANEL_HEIGHT_DEFAULT,
  PANEL_HEIGHT_LARGE_STEP,
  PANEL_HEIGHT_MAX,
  PANEL_HEIGHT_MIN,
  PANEL_HEIGHT_STEP,
  clampPanelHeight,
  panelHeightLimit,
} from "./panelSize";

function stageOf(node: HTMLElement | null) {
  return node?.closest<HTMLElement>(".center-stage") ?? null;
}

const useCommitEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function useResizablePanel(height: number, onChange: (next: number) => void) {
  const panelRef = useRef<HTMLElement>(null);
  const endDragRef = useRef<(() => void) | null>(null);
  const [dragging, setDragging] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [restoreHeight, setRestoreHeight] = useState(height);

  useEffect(() => () => endDragRef.current?.(), []);

  useCommitEffect(() => {
    const stage = stageOf(panelRef.current);
    if (stage) stage.scrollTop = stage.scrollHeight;
  }, [height]);

  const stageLimit = useCallback(() => {
    const stage = stageOf(panelRef.current);
    const graph = stage?.querySelector<HTMLElement>(".graph-frame");
    if (!stage || !graph) return PANEL_HEIGHT_MAX;
    return panelHeightLimit(panelRef.current?.offsetHeight ?? height, graph.offsetHeight, stage.scrollHeight - stage.clientHeight);
  }, [height]);

  const measuredHeight = useCallback(() => panelRef.current?.offsetHeight ?? height, [height]);

  const resize = useCallback(
    (next: number) => {
      setMaximized(false);
      onChange(clampPanelHeight(next, stageLimit()));
    },
    [onChange, stageLimit],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || endDragRef.current) return;
      const startY = event.clientY;
      const startHeight = measuredHeight();
      const max = stageLimit();

      setDragging(true);
      setMaximized(false);
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";

      function handleMove(moveEvent: PointerEvent) {
        onChange(clampPanelHeight(startHeight + (startY - moveEvent.clientY), max));
      }

      function handleKey(keyEvent: KeyboardEvent) {
        if (keyEvent.key === "Escape") finish();
      }

      function finish() {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        window.removeEventListener("keydown", handleKey, true);
        document.body.style.removeProperty("cursor");
        document.body.style.removeProperty("user-select");
        endDragRef.current = null;
        setDragging(false);
      }

      endDragRef.current = finish;
      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
      window.addEventListener("keydown", handleKey, true);
    },
    [measuredHeight, onChange, stageLimit],
  );

  const toggleMaximize = useCallback(() => {
    if (maximized) {
      setMaximized(false);
      onChange(clampPanelHeight(restoreHeight));
      return;
    }
    setRestoreHeight(height);
    setMaximized(true);
    onChange(clampPanelHeight(stageLimit()));
  }, [height, maximized, onChange, restoreHeight, stageLimit]);

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const step = event.shiftKey ? PANEL_HEIGHT_LARGE_STEP : PANEL_HEIGHT_STEP;
      const from = measuredHeight();
      if (event.key === "ArrowUp") resize(from + step);
      else if (event.key === "ArrowDown") resize(from - step);
      else if (event.key === "Home") resize(PANEL_HEIGHT_MIN);
      else if (event.key === "End") resize(stageLimit());
      else if (event.key === "Enter" || event.key === " ") toggleMaximize();
      else return;
      event.preventDefault();
    },
    [measuredHeight, resize, stageLimit, toggleMaximize],
  );

  const resetHeight = useCallback(() => resize(PANEL_HEIGHT_DEFAULT), [resize]);

  return {
    panelRef,
    dragging,
    maximized,
    toggleMaximize,
    resizeHandlers: { onPointerDown, onDoubleClick: resetHeight, onKeyDown },
  };
}