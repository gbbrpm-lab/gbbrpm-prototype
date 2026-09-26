export type DatasetMode = "synthetic" | "operational" | "imported";

export interface NodeRecord {
  id: string;
  B: number;
  outlet: boolean;
  label?: string;
}

export interface EdgeRecord {
  source: string;
  target: string;
  L?: number | null;
  C?: number | null;
  S?: number | null;
  tau: number;
}

export interface DatasetPayload {
  id: string;
  name: string;
  mode: DatasetMode;
  description: string;
  source_note: string;
  nodes: NodeRecord[];
  edges: EdgeRecord[];
}

export interface DatasetSummary {
  id: string;
  name: string;
  mode: DatasetMode;
  description: string;
  node_count: number;
  edge_count: number;
}

export interface RiskRecord {
  id: string;
  risk: number;
  rank: number;
  local_disturbance: number;
  outlet: boolean;
}

export interface EdgeContribution extends EdgeRecord {
  R_source: number;
  Q: number;
  S: number;
  u?: number | null;
}

export interface EvaluationResponse {
  dataset_id: string;
  mode: DatasetMode;
  provenance: string;
  risks: RiskRecord[];
  contributions: EdgeContribution[];
  summary: {
    highest_risk_node: string;
    highest_risk: number;
    outlet_risks: Record<string, number>;
    node_count: number;
    edge_count: number;
  };
  metadata: Record<string, number>;
}

export type Selection =
  | { type: "node"; id: string }
  | { type: "edge"; source: string; target: string }
  | null;
