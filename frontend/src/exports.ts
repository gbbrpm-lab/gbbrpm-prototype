import { buildComparisonRows, summarizeComparison } from "./scenario";
import type { DatasetPayload, EvaluationResponse, ScenarioSnapshot } from "./types";

const MODEL_VERSION = "0.1.0";
const MANIFEST_SCHEMA_VERSION = "1.0";

function spreadsheetSafe(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function csvCell(value: string | number | boolean): string {
  const text = spreadsheetSafe(String(value));
  return `"${text.replaceAll('"', '""')}"`;
}

function safeFilename(value: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
  return normalized.replace(/^-+|-+$/g, "") || "gbbrpm-analysis";
}

function downloadText(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exportComparisonCsv(
  baseline: ScenarioSnapshot,
  candidateDataset: DatasetPayload,
  candidateEvaluation: EvaluationResponse,
) {
  const rows = buildComparisonRows(baseline.evaluation, candidateEvaluation);
  const header = [
    "dataset_id",
    "component_id",
    "outlet",
    "baseline_risk",
    "current_risk",
    "risk_delta",
    "baseline_rank",
    "current_rank",
    "rank_movement",
  ];
  const records = rows.map((row) => [
    candidateDataset.id,
    row.id,
    row.outlet,
    row.baselineRisk,
    row.candidateRisk,
    row.delta,
    row.baselineRank,
    row.candidateRank,
    row.rankMovement,
  ]);
  const csv = [header, ...records]
    .map((record) => record.map(csvCell).join(","))
    .join("\r\n");

  downloadText(
    `${safeFilename(candidateDataset.id)}-scenario-comparison.csv`,
    `${csv}\r\n`,
    "text/csv",
  );
}

export function exportAnalysisManifest(
  baseline: ScenarioSnapshot,
  candidateDataset: DatasetPayload,
  candidateEvaluation: EvaluationResponse,
) {
  const rows = buildComparisonRows(baseline.evaluation, candidateEvaluation);
  const summary = summarizeComparison(rows, candidateEvaluation);
  const manifest = {
    schema_version: MANIFEST_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    application: {
      name: "GBBRPM Prototype",
      model: "gbbrpm",
      model_version: MODEL_VERSION,
    },
    evidence_boundary:
      "Values are bounded modeled risk indices, not probabilities or direct predictions of real-world failure or flooding.",
    provenance: {
      dataset_mode: candidateDataset.mode,
      source_note: candidateDataset.source_note,
      evaluator: candidateEvaluation.provenance,
    },
    baseline,
    candidate: {
      label: "Current evaluated scenario",
      dataset: candidateDataset,
      evaluation: candidateEvaluation,
    },
    comparison: {
      summary,
      rows,
    },
  };

  downloadText(
    `${safeFilename(candidateDataset.id)}-analysis-manifest.json`,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "application/json",
  );
}
