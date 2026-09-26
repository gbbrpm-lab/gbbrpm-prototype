import {
  ArrowDown,
  ArrowUp,
  Download,
  FileJson,
  GitCompareArrows,
  Minus,
} from "lucide-react";

import { buildComparisonRows, summarizeComparison } from "../scenario";
import type { EvaluationResponse } from "../types";

interface Props {
  baseline: EvaluationResponse | null;
  candidate: EvaluationResponse | null;
  dirty: boolean;
  onSelectNode: (id: string) => void;
  onExportCsv: () => void;
  onExportManifest: () => void;
}

const fmt = (value: number) => value.toFixed(4);

function movementLabel(value: number) {
  if (value > 0) return <><ArrowUp size={12} />{value}</>;
  if (value < 0) return <><ArrowDown size={12} />{Math.abs(value)}</>;
  return <><Minus size={12} />0</>;
}

export function ScenarioComparison({
  baseline,
  candidate,
  dirty,
  onSelectNode,
  onExportCsv,
  onExportManifest,
}: Props) {
  if (!baseline || !candidate) {
    return (
      <div className="comparison-empty">
        <GitCompareArrows size={34} />
        <strong>No comparable evaluations yet</strong>
        <span>Load a network and run the model to establish a baseline.</span>
      </div>
    );
  }

  const rows = buildComparisonRows(baseline, candidate);
  const summary = summarizeComparison(rows, candidate);

  return (
    <div className="comparison-view">
      {dirty && (
        <div className="comparison-warning">
          Parameters have changed since the current evaluation. Run the model before interpreting this comparison.
        </div>
      )}

      <div className="comparison-summary">
        <div>
          <span>Largest risk increase</span>
          <strong>{summary.greatestIncreaseNode ?? "None"}</strong>
          <output>{summary.greatestIncrease > 0 ? `+${fmt(summary.greatestIncrease)}` : fmt(0)}</output>
        </div>
        <div>
          <span>Changed components</span>
          <strong>{summary.changedComponents}</strong>
          <output>of {summary.componentCount} nodes</output>
        </div>
        <div>
          <span>Mean absolute Δ</span>
          <strong>{fmt(summary.meanAbsoluteDelta)}</strong>
          <output>risk-index units</output>
        </div>
        <div>
          <span>Highest current risk</span>
          <strong>{summary.highestCurrentRiskNode}</strong>
          <output>{fmt(summary.highestCurrentRisk)}</output>
        </div>
      </div>

      <div className="comparison-table-wrap">
        <div className="comparison-table-title">
          <div>
            <p className="eyebrow">Component deltas</p>
            <span>Sorted by greatest modeled-risk increase</span>
          </div>
          <div className="comparison-tools">
            <div className="scenario-key"><i /> Baseline <i /> Current</div>
            <button disabled={dirty} onClick={onExportCsv} title={dirty ? "Run the model before exporting" : "Export comparison table as CSV"}>
              <Download size={13} /> CSV
            </button>
            <button disabled={dirty} onClick={onExportManifest} title={dirty ? "Run the model before exporting" : "Export complete reproducibility manifest"}>
              <FileJson size={13} /> Manifest
            </button>
          </div>
        </div>
        <table className="comparison-table">
          <thead>
            <tr>
              <th>Component</th>
              <th>Baseline</th>
              <th>Current</th>
              <th>Risk Δ</th>
              <th>Rank</th>
              <th>Movement</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} onClick={() => onSelectNode(row.id)}>
                <td><strong>{row.id}</strong>{row.outlet && <small>Outlet</small>}</td>
                <td>{fmt(row.baselineRisk)}</td>
                <td>{fmt(row.candidateRisk)}</td>
                <td className={row.delta > 0 ? "delta-up" : row.delta < 0 ? "delta-down" : "delta-flat"}>
                  {row.delta > 0 ? "+" : ""}{fmt(row.delta)}
                </td>
                <td>{row.baselineRank} → {row.candidateRank}</td>
                <td>
                  <span className={row.rankMovement > 0 ? "movement-up" : row.rankMovement < 0 ? "movement-down" : "movement-flat"}>
                    {movementLabel(row.rankMovement)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
