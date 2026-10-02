import { describe, expect, it } from "vitest";
import {
  PANEL_HEIGHT_DEFAULT,
  PANEL_HEIGHT_KEY,
  PANEL_HEIGHT_MAX,
  PANEL_HEIGHT_MIN,
  clampPanelHeight,
  loadPanelHeight,
  panelHeightLimit,
  persistPanelHeight,
} from "./panelSize";

function memory(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  };
}

describe("walkthrough panel sizing", () => {
  it("clamps to the minimum and the absolute maximum", () => {
    expect(clampPanelHeight(10)).toBe(PANEL_HEIGHT_MIN);
    expect(clampPanelHeight(9999)).toBe(PANEL_HEIGHT_MAX);
    expect(clampPanelHeight(240)).toBe(240);
    expect(clampPanelHeight(240.6)).toBe(241);
    expect(clampPanelHeight(Number.NaN)).toBe(PANEL_HEIGHT_DEFAULT);
    expect(clampPanelHeight(600, 320)).toBe(320);
  });

  it("never clamps below the minimum on a cramped stage", () => {
    expect(clampPanelHeight(224, -63)).toBe(PANEL_HEIGHT_MIN);
    expect(clampPanelHeight(224, 0)).toBe(PANEL_HEIGHT_MIN);
  });

  it("stretches until the panel covers the whole graph area", () => {
    expect(panelHeightLimit(224, 576)).toBe(799);
    expect(panelHeightLimit(300, 180)).toBe(479);
    expect(panelHeightLimit(224, 0)).toBe(223);
    expect(panelHeightLimit(224, 5000)).toBe(PANEL_HEIGHT_MAX);
  });

  it("leaves a pixel of slack so full coverage never overflows the stage", () => {
    expect(panelHeightLimit(224, 576.5)).toBe(800 - 1);
    expect(panelHeightLimit(224.4, 575.6)).toBe(799);
    expect(panelHeightLimit(638.2, 0)).toBe(637);
  });

  it("absorbs an already overflowing stage into the limit", () => {
    expect(panelHeightLimit(300, 400, 0)).toBe(699);
    expect(panelHeightLimit(300, 400, 120)).toBe(579);
    expect(panelHeightLimit(300, 400, -8)).toBe(699);
  });

  it("round-trips the height through storage", () => {
    const storage = memory();
    expect(loadPanelHeight(storage)).toBe(PANEL_HEIGHT_DEFAULT);
    expect(persistPanelHeight(storage, 312)).toBe(true);
    expect(storage.store.get(PANEL_HEIGHT_KEY)).toBe("312");
    expect(loadPanelHeight(storage)).toBe(312);
  });

  it("falls back to the default for corrupt or hostile storage", () => {
    expect(loadPanelHeight(memory({ [PANEL_HEIGHT_KEY]: "not-a-number" }))).toBe(PANEL_HEIGHT_DEFAULT);
    expect(loadPanelHeight(memory({ [PANEL_HEIGHT_KEY]: "99999" }))).toBe(PANEL_HEIGHT_MAX);
    expect(loadPanelHeight(memory({ [PANEL_HEIGHT_KEY]: "12" }))).toBe(PANEL_HEIGHT_MIN);
    expect(loadPanelHeight(undefined)).toBe(PANEL_HEIGHT_DEFAULT);
    const hostile = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    };
    expect(loadPanelHeight(hostile)).toBe(PANEL_HEIGHT_DEFAULT);
    expect(persistPanelHeight(hostile, 300)).toBe(false);
  });
});