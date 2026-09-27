import { describe, expect, it } from "vitest";

import {
  createSavedScenario,
  loadSavedScenarios,
  persistSavedScenarios,
  SAVED_SCENARIOS_KEY,
} from "./scenarioStore";
import type { ScenarioSnapshot } from "./types";

class MemoryStorage {
  values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const snapshot: ScenarioSnapshot = {
  label: "N1 test",
  dataset: {
    id: "N1",
    name: "N1",
    mode: "synthetic",
    description: "Test network",
    source_note: "Controlled fixture",
    nodes: [
      { id: "A", B: 0.5, outlet: false },
      { id: "B", B: 0, outlet: true },
    ],
    edges: [{ source: "A", target: "B", L: 1, C: 2, tau: 1 }],
  },
  evaluation: {
    dataset_id: "N1",
    mode: "synthetic",
    provenance: "gbbrpm 0.1.0",
    risks: [
      { id: "A", risk: 0.5, rank: 1, local_disturbance: 0.5, outlet: false },
      { id: "B", risk: 0.25, rank: 2, local_disturbance: 0, outlet: true },
    ],
    contributions: [],
    summary: {
      highest_risk_node: "A",
      highest_risk: 0.5,
      outlet_risks: { B: 0.25 },
      node_count: 2,
      edge_count: 1,
    },
    metadata: {},
  },
};

describe("saved scenario storage", () => {
  it("round-trips a versioned scenario", () => {
    const storage = new MemoryStorage();
    const saved = createSavedScenario("Capacity stress", snapshot);

    persistSavedScenarios(storage, [saved]);

    expect(loadSavedScenarios(storage)).toEqual([saved]);
    expect(saved.schemaVersion).toBe("1.0");
    expect(saved.modelVersion).toBe("0.1.0");
  });

  it("returns an empty list for malformed storage", () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVED_SCENARIOS_KEY, "not-json");

    expect(loadSavedScenarios(storage)).toEqual([]);
  });

  it("filters incompatible stored versions", () => {
    const storage = new MemoryStorage();
    const incompatible = { ...createSavedScenario("Old", snapshot), modelVersion: "0.0.9" };
    storage.setItem(SAVED_SCENARIOS_KEY, JSON.stringify([incompatible]));

    expect(loadSavedScenarios(storage)).toEqual([]);
  });

  it("filters structurally invalid entries", () => {
    const storage = new MemoryStorage();
    const invalid = { ...createSavedScenario("Broken", snapshot), snapshot: { dataset: {} } };
    storage.setItem(SAVED_SCENARIOS_KEY, JSON.stringify([invalid]));

    expect(loadSavedScenarios(storage)).toEqual([]);
  });

  it("clones the saved snapshot", () => {
    const saved = createSavedScenario("Independent copy", snapshot);
    snapshot.dataset.nodes[0].B = 1;

    expect(saved.snapshot.dataset.nodes[0].B).toBe(0.5);
  });
});
