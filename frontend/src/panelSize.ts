export const PANEL_HEIGHT_KEY = "gbbrpm.walkthrough-panel-height.v1";
export const PANEL_HEIGHT_DEFAULT = 224;
export const PANEL_HEIGHT_MIN = 120;
export const PANEL_HEIGHT_MAX = 880;
export const PANEL_HEIGHT_STEP = 16;
export const PANEL_HEIGHT_LARGE_STEP = 64;

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function clampPanelHeight(value: number, max: number = PANEL_HEIGHT_MAX): number {
  if (!Number.isFinite(value)) return PANEL_HEIGHT_DEFAULT;
  const upper = Math.max(PANEL_HEIGHT_MIN, Math.min(Math.round(max), PANEL_HEIGHT_MAX));
  return Math.round(Math.min(Math.max(value, PANEL_HEIGHT_MIN), upper));
}

export function graphHeightLimit(graphHeight: number): number {
  return clampPanelHeight(Math.floor(graphHeight) - 1);
}

export function loadPanelHeight(storage: StorageLike | undefined): number {
  try {
    const raw = storage?.getItem(PANEL_HEIGHT_KEY);
    if (raw == null) return PANEL_HEIGHT_DEFAULT;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? clampPanelHeight(parsed) : PANEL_HEIGHT_DEFAULT;
  } catch {
    return PANEL_HEIGHT_DEFAULT;
  }
}

export function persistPanelHeight(storage: StorageLike | undefined, height: number): boolean {
  try {
    storage?.setItem(PANEL_HEIGHT_KEY, String(Math.round(height)));
    return true;
  } catch {
    return false;
  }
}