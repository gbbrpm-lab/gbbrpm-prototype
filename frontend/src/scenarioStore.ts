import type { SavedScenario, ScenarioSnapshot } from "./types";

export const SAVED_SCENARIOS_KEY = "gbbrpm.saved-scenarios.v1";
export const SAVED_SCENARIO_SCHEMA = "1.0" as const;
export const MODEL_VERSION = "0.1.0" as const;

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function isSavedScenario(value: unknown): value is SavedScenario {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SavedScenario>;
  const dataset = item.snapshot?.dataset;
  const evaluation = item.snapshot?.evaluation;
  return Boolean(
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.savedAt === "string" &&
    item.schemaVersion === SAVED_SCENARIO_SCHEMA &&
    item.modelVersion === MODEL_VERSION &&
    dataset &&
    typeof dataset.id === "string" &&
    ["synthetic", "operational", "imported"].includes(dataset.mode) &&
    Array.isArray(dataset.nodes) &&
    Array.isArray(dataset.edges) &&
    evaluation &&
    Array.isArray(evaluation.risks),
  );
}

export function loadSavedScenarios(storage: StorageLike): SavedScenario[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(SAVED_SCENARIOS_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter(isSavedScenario).sort((a, b) => b.savedAt.localeCompare(a.savedAt))
      : [];
  } catch {
    return [];
  }
}

export function persistSavedScenarios(storage: StorageLike, scenarios: SavedScenario[]) {
  storage.setItem(SAVED_SCENARIOS_KEY, JSON.stringify(scenarios));
}

export function createSavedScenario(name: string, snapshot: ScenarioSnapshot): SavedScenario {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: name.trim(),
    savedAt: new Date().toISOString(),
    schemaVersion: SAVED_SCENARIO_SCHEMA,
    modelVersion: MODEL_VERSION,
    snapshot: structuredClone(snapshot),
  };
}
