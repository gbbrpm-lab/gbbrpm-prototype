import {
  Activity,
  BookmarkCheck,
  Database,
  FileUp,
  GitCompareArrows,
  Network,
  Play,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api } from "./api";
import { GraphCanvas } from "./components/GraphCanvas";
import { SavedScenarios } from "./components/SavedScenarios";
import { ScenarioComparison } from "./components/ScenarioComparison";
import { exportAnalysisManifest, exportComparisonCsv } from "./exports";
import {
  createSavedScenario,
  loadSavedScenarios,
  persistSavedScenarios,
} from "./scenarioStore";
import type {
  DatasetMode,
  DatasetPayload,
  DatasetSummary,
  EvaluationResponse,
  SavedScenario,
  ScenarioSnapshot,
  Selection,
} from "./types";

const MODES: { id: DatasetMode; label: string; detail: string }[] = [
  { id: "synthetic", label: "Synthetic", detail: "Controlled N1–N5 fixtures" },
  { id: "operational", label: "Operational", detail: "Agency-provided network records" },
  { id: "imported", label: "Imported", detail: "Validated JSON dataset" },
];

const fmt = (value: number) => value.toFixed(4);

function compatibleForComparison(left: DatasetPayload, right: DatasetPayload) {
  const nodeKey = (payload: DatasetPayload) => payload.nodes.map((node) => node.id).sort().join("|");
  const edgeKey = (payload: DatasetPayload) => payload.edges
    .map((edge) => `${edge.source}->${edge.target}`)
    .sort()
    .join("|");
  return left.id === right.id && nodeKey(left) === nodeKey(right) && edgeKey(left) === edgeKey(right);
}

export default function App() {
  const [mode, setMode] = useState<DatasetMode>("synthetic");
  const [summaries, setSummaries] = useState<DatasetSummary[]>([]);
  const [selectedId, setSelectedId] = useState("N1");
  const [dataset, setDataset] = useState<DatasetPayload | null>(null);
  const [pristine, setPristine] = useState<DatasetPayload | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null);
  const [baseline, setBaseline] = useState<ScenarioSnapshot | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [activeView, setActiveView] = useState<"network" | "comparison">("network");
  const [dirty, setDirty] = useState(false);
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const [status, setStatus] = useState("Loading synthetic fixtures…");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const skipSyntheticLoadRef = useRef(false);

  const runEvaluation = useCallback(async (payload: DatasetPayload, captureBaseline = false) => {
    setBusy(true);
    setStatus("Evaluating directed network…");
    try {
      const result = await api.evaluate(payload);
      setEvaluation(result);
      if (captureBaseline) {
        setBaseline({
          label: "Initial evaluated scenario",
          dataset: structuredClone(payload),
          evaluation: structuredClone(result),
        });
      }
      setDirty(false);
      setStatus(`Evaluation complete · ${result.risks.length} ranked nodes`);
      return result;
    } catch (error) {
      setEvaluation(null);
      setStatus(error instanceof Error ? error.message : "Evaluation failed");
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    api.listDatasets()
      .then((items) => setSummaries(items))
      .catch((error) => setStatus(error.message));
  }, []);

  useEffect(() => {
    setSavedScenarios(loadSavedScenarios(window.localStorage));
  }, []);

  useEffect(() => {
    if (mode !== "synthetic") return;
    if (skipSyntheticLoadRef.current) {
      skipSyntheticLoadRef.current = false;
      return;
    }
    setBusy(true);
    setEvaluation(null);
    setBaseline(null);
    setDirty(false);
    api.getDataset(selectedId)
      .then((payload) => {
        setDataset(payload);
        setPristine(structuredClone(payload));
        setSelection(null);
        setActiveView("network");
        return runEvaluation(payload, true);
      })
      .catch((error) => setStatus(error.message))
      .finally(() => setBusy(false));
  }, [mode, selectedId, runEvaluation]);

  const riskMap = useMemo(
    () => new Map(evaluation?.risks.map((item) => [item.id, item.risk]) ?? []),
    [evaluation],
  );

  const selectedNode =
    selection?.type === "node"
      ? dataset?.nodes.find((node) => node.id === selection.id)
      : undefined;
  const selectedEdge =
    selection?.type === "edge"
      ? dataset?.edges.find(
          (edge) =>
            edge.source === selection.source && edge.target === selection.target,
        )
      : undefined;

  function selectMode(nextMode: DatasetMode) {
    setMode(nextMode);
    setEvaluation(null);
    setBaseline(null);
    setSelection(null);
    setDirty(false);
    setActiveView("network");
    if (nextMode === "operational") {
      setDataset(null);
      setStatus("No operational dataset configured yet");
    }
    if (nextMode === "imported") {
      setDataset(null);
      setStatus("Upload a JSON dataset matching the common schema");
    }
  }

  function updateNodeB(value: number) {
    if (!dataset || !selectedNode) return;
    setDataset({
      ...dataset,
      nodes: dataset.nodes.map((node) =>
        node.id === selectedNode.id ? { ...node, B: value } : node,
      ),
    });
    setDirty(true);
    setStatus("Scenario modified · run the model to update results");
  }

  function updateEdge(field: "L" | "C" | "tau", value: number) {
    if (!dataset || !selectedEdge) return;
    setDataset({
      ...dataset,
      edges: dataset.edges.map((edge) =>
        edge.source === selectedEdge.source && edge.target === selectedEdge.target
          ? { ...edge, [field]: value }
          : edge,
      ),
    });
    setDirty(true);
    setStatus("Scenario modified · run the model to update results");
  }

  async function importDataset(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as DatasetPayload;
      const payload = {
        ...parsed,
        mode: "imported" as const,
        source_note: parsed.source_note || `Imported from ${file.name}`,
      };
      await api.validateDataset(payload);
      setDataset(payload);
      setPristine(structuredClone(payload));
      setStatus(`Validated ${file.name}`);
      setActiveView("network");
      await runEvaluation(payload, true);
    } catch (error) {
      setDataset(null);
      setStatus(error instanceof Error ? error.message : "Import failed");
    }
  }

  function resetDataset() {
    if (!pristine) return;
    const reset = structuredClone(pristine);
    setDataset(reset);
    setSelection(null);
    void runEvaluation(reset);
  }

  function saveBaseline() {
    if (!dataset || !evaluation || dirty) return;
    setBaseline({
      label: "Saved evaluated scenario",
      dataset: structuredClone(dataset),
      evaluation: structuredClone(evaluation),
    });
    setStatus("Current evaluated scenario saved as baseline");
  }

  function updateSavedScenarios(next: SavedScenario[]) {
    try {
      persistSavedScenarios(window.localStorage, next);
      setSavedScenarios(next);
      return true;
    } catch {
      setStatus("Could not update browser-local scenario storage");
      return false;
    }
  }

  function saveNamedScenario(name: string) {
    if (!dataset || !evaluation || dirty) return;
    if (savedScenarios.some((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setStatus(`A saved scenario named “${name}” already exists`);
      return;
    }
    const saved = createSavedScenario(name, {
      label: name,
      dataset,
      evaluation,
    });
    if (updateSavedScenarios([saved, ...savedScenarios])) {
      setStatus(`Saved “${name}” in this browser`);
    }
  }

  async function loadNamedScenario(saved: SavedScenario, promoteToBaseline = false) {
    const payload = structuredClone(saved.snapshot.dataset);
    const previousBaseline = baseline;
    const canRetainBaseline = Boolean(
      !promoteToBaseline && previousBaseline && compatibleForComparison(previousBaseline.dataset, payload),
    );

    if (payload.mode === "synthetic") {
      skipSyntheticLoadRef.current = mode !== "synthetic" || selectedId !== payload.id;
      setSelectedId(payload.id);
    }
    setMode(payload.mode);
    setDataset(payload);
    setPristine(structuredClone(payload));
    setEvaluation(null);
    setSelection(null);
    setActiveView("network");
    setDirty(false);
    if (!canRetainBaseline) setBaseline(null);

    const result = await runEvaluation(payload);
    if (!result) return;

    if (promoteToBaseline || !canRetainBaseline) {
      setBaseline({
        label: saved.name,
        dataset: structuredClone(payload),
        evaluation: structuredClone(result),
      });
    }
    setStatus(
      promoteToBaseline
        ? `Loaded and verified “${saved.name}” as the comparison baseline`
        : `Loaded and verified “${saved.name}”`,
    );
  }

  function renameSavedScenario(id: string, name: string) {
    const duplicate = savedScenarios.some(
      (item) => item.id !== id && item.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
    if (duplicate) {
      setStatus(`A saved scenario named “${name}” already exists`);
      return;
    }
    const next = savedScenarios.map((item) => item.id === id
      ? { ...item, name, snapshot: { ...item.snapshot, label: name } }
      : item);
    if (updateSavedScenarios(next)) setStatus(`Renamed saved scenario to “${name}”`);
  }

  function deleteSavedScenario(id: string) {
    const target = savedScenarios.find((item) => item.id === id);
    if (!target || !window.confirm(`Delete the browser-local scenario “${target.name}”?`)) return;
    if (updateSavedScenarios(savedScenarios.filter((item) => item.id !== id))) {
      setStatus(`Deleted “${target.name}”`);
    }
  }

  function downloadComparisonCsv() {
    if (!baseline || !dataset || !evaluation || dirty) return;
    exportComparisonCsv(baseline, dataset, evaluation);
    setStatus("Scenario comparison exported as CSV");
  }

  function downloadAnalysisManifest() {
    if (!baseline || !dataset || !evaluation || dirty) return;
    exportAnalysisManifest(baseline, dataset, evaluation);
    setStatus("Reproducibility manifest exported as JSON");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark"><Network size={21} /></div>
        <div className="brand-copy">
          <strong>GBBRPM</strong>
          <span>Risk propagation workspace</span>
        </div>
        <div className="model-chip"><ShieldCheck size={15} /> Engine v0.1.0</div>
      </header>

      <main className="workspace">
        <aside className="left-panel panel">
          <p className="eyebrow">Data source</p>
          <div className="mode-list">
            {MODES.map((item) => (
              <button
                className={`mode-button ${mode === item.id ? "active" : ""}`}
                key={item.id}
                onClick={() => selectMode(item.id)}
              >
                {item.id === "imported" ? <FileUp size={17} /> : <Database size={17} />}
                <span><strong>{item.label}</strong><small>{item.detail}</small></span>
              </button>
            ))}
          </div>

          {mode === "synthetic" && (
            <div className="field-block">
              <label htmlFor="network-select">Controlled network</label>
              <select
                id="network-select"
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                {summaries.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.id} · {item.description}
                  </option>
                ))}
              </select>
            </div>
          )}

          {mode === "imported" && (
            <div className="upload-card">
              <FileUp size={23} />
              <strong>Import network JSON</strong>
              <p>The backend validates fields, endpoints, bounds, and DAG structure.</p>
              <button className="secondary-button" onClick={() => fileRef.current?.click()}>
                Choose file
              </button>
              <input
                ref={fileRef}
                hidden
                type="file"
                accept="application/json,.json"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importDataset(file);
                }}
              />
            </div>
          )}

          {mode === "operational" && (
            <div className="empty-card">
              <Database size={22} />
              <strong>Awaiting operational data</strong>
              <p>The adapter slot is ready; no agency dataset is represented as available.</p>
            </div>
          )}

          {dataset && (
            <div className="dataset-facts">
              <div><span>Nodes</span><strong>{dataset.nodes.length}</strong></div>
              <div><span>Edges</span><strong>{dataset.edges.length}</strong></div>
              <div><span>Mode</span><strong>{dataset.mode}</strong></div>
            </div>
          )}

          <SavedScenarios
            scenarios={savedScenarios}
            canSave={Boolean(dataset && evaluation && !dirty && !busy)}
            defaultName={dataset ? `${dataset.id} scenario` : "Scenario name"}
            onSave={saveNamedScenario}
            onLoad={(saved) => void loadNamedScenario(saved)}
            onUseAsBaseline={(saved) => void loadNamedScenario(saved, true)}
            onRename={renameSavedScenario}
            onDelete={deleteSavedScenario}
          />
        </aside>

        <section className="center-stage panel">
          <div className="stage-header">
            <div>
              <p className="eyebrow">Directed network</p>
              <h1>{dataset?.name ?? "No active network"}</h1>
              <p>{dataset?.description ?? "Select or import a dataset to begin."}</p>
            </div>
            {dataset && (
              <div className="stage-actions">
                <button
                  className="baseline-button"
                  disabled={busy || dirty || !evaluation}
                  title={dirty ? "Run the modified scenario before saving it" : "Save current evaluation as baseline"}
                  onClick={saveBaseline}
                >
                  <BookmarkCheck size={15} /> Save baseline
                </button>
                <button className="icon-button" title="Reset dataset" onClick={resetDataset}>
                  <RotateCcw size={17} />
                </button>
                <button
                  className="primary-button"
                  disabled={busy}
                  onClick={() => void runEvaluation(dataset)}
                >
                  <Play size={16} fill="currentColor" /> {busy ? "Running…" : "Run model"}
                </button>
              </div>
            )}
          </div>

          <div className="view-tabs" role="tablist" aria-label="Analysis view">
            <button
              className={activeView === "network" ? "active" : ""}
              role="tab"
              aria-selected={activeView === "network"}
              onClick={() => setActiveView("network")}
            >
              <Network size={14} /> Network view
            </button>
            <button
              className={activeView === "comparison" ? "active" : ""}
              role="tab"
              aria-selected={activeView === "comparison"}
              onClick={() => setActiveView("comparison")}
            >
              <GitCompareArrows size={14} /> Scenario comparison
            </button>
            <span>{baseline ? "Baseline ready" : "No baseline"}</span>
          </div>

          {activeView === "network" ? (
            <div className="graph-frame">
              {dataset ? (
                <GraphCanvas dataset={dataset} evaluation={evaluation} onSelect={setSelection} />
              ) : (
                <div className="graph-empty"><Network size={35} /><span>No graph loaded</span></div>
              )}
              <div className="legend">
                <span><i className="low" />Low</span>
                <span><i className="medium" />Moderate</span>
                <span><i className="high" />High</span>
                <span><i className="critical" />Very high</span>
              </div>
            </div>
          ) : (
            <ScenarioComparison
              baseline={baseline?.evaluation ?? null}
              candidate={evaluation}
              dirty={dirty}
              onExportCsv={downloadComparisonCsv}
              onExportManifest={downloadAnalysisManifest}
              onSelectNode={(id) => {
                setSelection({ type: "node", id });
                setActiveView("network");
              }}
            />
          )}
          <div className="statusbar"><Activity size={14} /> {status}</div>
        </section>

        <aside className="right-panel panel">
          <p className="eyebrow">Inspector</p>
          {selectedNode ? (
            <div className="inspector">
              <div className="selection-title"><span>Node</span><strong>{selectedNode.id}</strong></div>
              <label>Local disturbance B <output>{selectedNode.B.toFixed(2)}</output></label>
              <input
                type="range" min="0" max="1" step="0.05"
                value={selectedNode.B}
                onChange={(event) => updateNodeB(Number(event.target.value))}
              />
              <div className={`metric-card ${dirty ? "stale" : ""}`}>
                <span>{dirty ? "Propagated risk · last run" : "Propagated risk"}</span>
                <strong>{fmt(riskMap.get(selectedNode.id) ?? selectedNode.B)}</strong>
              </div>
              {selectedNode.outlet && <div className="outlet-badge">Declared outlet</div>}
            </div>
          ) : selectedEdge ? (
            <div className="inspector">
              <div className="selection-title"><span>Edge</span><strong>{selectedEdge.source} → {selectedEdge.target}</strong></div>
              {(["L", "C", "tau"] as const).map((field) => (
                <label className="numeric-field" key={field}>
                  <span>{field === "L" ? "Load L" : field === "C" ? "Capacity C" : "Transmission τ"}</span>
                  <input
                    type="number"
                    min={field === "C" ? 0.01 : 0}
                    max={field === "tau" ? 1 : undefined}
                    step={field === "tau" ? 0.05 : 1}
                    value={selectedEdge[field] ?? ""}
                    onChange={(event) => updateEdge(field, Number(event.target.value))}
                  />
                </label>
              ))}
              <div className="metric-card">
                <span>Derived susceptibility</span>
                <strong>{fmt(Math.min(1, (selectedEdge.L ?? 0) / (selectedEdge.C ?? 1)))}</strong>
              </div>
            </div>
          ) : (
            <div className="inspector-empty">Select a node or edge to inspect and modify its parameters.</div>
          )}

          <div className="ranking-header">
            <div><p className="eyebrow">Risk ranking</p><span>{dirty ? "Last evaluation · rerun required" : "Current evaluation"}</span></div>
            <strong>{evaluation?.risks.length ?? 0}</strong>
          </div>
          <div className="ranking-list">
            {evaluation?.risks.map((item) => (
              <button key={item.id} onClick={() => setSelection({ type: "node", id: item.id })}>
                <span className="rank">{item.rank}</span>
                <strong>{item.id}</strong>
                <div className="risk-bar"><i style={{ width: `${item.risk * 100}%` }} /></div>
                <output>{fmt(item.risk)}</output>
              </button>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}
