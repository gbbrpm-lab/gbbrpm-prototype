import type {
  ComparisonRow,
  ComparisonSummary,
  EvaluationResponse,
} from "./types";

export function buildComparisonRows(
  baseline: EvaluationResponse,
  candidate: EvaluationResponse,
): ComparisonRow[] {
  const baselineById = new Map(baseline.risks.map((item) => [item.id, item]));

  return candidate.risks.map((item) => {
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
}

export function summarizeComparison(
  rows: ComparisonRow[],
  candidate: EvaluationResponse,
): ComparisonSummary {
  const changed = rows.filter((row) => Math.abs(row.delta) > 1e-12);
  const greatestIncrease = rows.find((row) => row.delta > 1e-12);
  const meanAbsoluteDelta = rows.length
    ? rows.reduce((sum, row) => sum + Math.abs(row.delta), 0) / rows.length
    : 0;

  return {
    changedComponents: changed.length,
    componentCount: rows.length,
    greatestIncreaseNode: greatestIncrease?.id ?? null,
    greatestIncrease: greatestIncrease?.delta ?? 0,
    meanAbsoluteDelta,
    highestCurrentRiskNode: candidate.summary.highest_risk_node,
    highestCurrentRisk: candidate.summary.highest_risk,
  };
}
