import { ArrowDown, ArrowUp, GitCompareArrows, Minus } from "lucide-react";

import type { EvaluationResponse } from "../types";

interface Props {
  baseline: EvaluationResponse | null;
  candidate: EvaluationResponse | null;
  dirty: boolean;
  onSelectNode: (id: string) => void;
}

interface ComparisonRow {
  id: string;
  baselineRisk: number;
  candidateRisk: number;
  delta: number;
  baselineRank: number;
  candidateRank: number;
  rankMovement: number;
  outlet: boolean;
}

const fmt = (value: number) => value.toFixed(4);

function movementLabel(value: number) {
  if (value > 0) return <><ArrowUp size={12} />{value}</>;
  if (value < 0) return <><ArrowDown size={12} />{Math.abs(value)}</>;
  return <><Minus size={12} />0</>;
}

export function ScenarioComparison({ baseline, candidate, dirty, onSelectNode }: Props) {
  if (!baseline || !candidate) {
    return (
      <div className="comparison-empty">
        <GitCompareArrows size={34} />
        <strong>No comparable evaluations yet</strong>
        <span>Load a network and run the model to establish a baseline.</span>
      </div>
    );
  }

  const baselineById = new Map(baseline.risks.map((item) => [item.id, item]));
  const rows: ComparisonRow[] = candidate.risks.map((item) => {
    const prior = baselineById.get(item.id);
    const baselineRisk = prior?.risk ?? 0;
    const baselineRank = prior?.rank ?? item.rank;
    return {
      id: item.id,
      baselineRisk,
      candidateRisk: item.risk,
      delta: item.risk - baselineRisk,
      baselineRank,
      candidateRank: item.rank,
      rankMovement: baselineRank - item.rank,
      outlet: item.outlet,
    };
  }).sort((a, b) => b.delta - a.delta || a.candidateRank - b.candidateRank);

  const changed = rows.filter((row) => Math.abs(row.delta) > 1e-12);
  const greatestIncrease = rows.find((row) => row.delta > 1e-12);
  const meanAbsoluteDelta = rows.length
    ? rows.reduce((sum, row) => sum + Math.abs(row.delta), 0) / rows.length
    : 0;

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
          <strong>{greatestIncrease ? greatestIncrease.id : "None"}</strong>
          <output>{greatestIncrease ? `+${fmt(greatestIncrease.delta)}` : fmt(0)}</output>
        </div>
        <div>
          <span>Changed components</span>
          <strong>{changed.length}</strong>
          <output>of {rows.length} nodes</output>
        </div>
        <div>
          <span>Mean absolute Δ</span>
          <strong>{fmt(meanAbsoluteDelta)}</strong>
          <output>risk-index units</output>
        </div>
        <div>
          <span>Highest current risk</span>
          <strong>{candidate.summary.highest_risk_node}</strong>
          <output>{fmt(candidate.summary.highest_risk)}</output>
        </div>
      </div>

      <div className="comparison-table-wrap">
        <div className="comparison-table-title">
          <div>
            <p className="eyebrow">Component deltas</p>
            <span>Sorted by greatest modeled-risk increase</span>
          </div>
          <div className="scenario-key"><i /> Baseline <i /> Current</div>
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
