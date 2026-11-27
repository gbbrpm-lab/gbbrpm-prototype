import math

import networkx as nx
import pandas as pd
from gbbrpm import evaluate_gbbrpm

from app.models import (
    DatasetPayload,
    EdgeContribution,
    EvaluationResponse,
    EvaluationSummary,
    EvaluationStep,
    RiskRecord,
    ValidationResponse,
)


def _graph(dataset: DatasetPayload) -> nx.DiGraph:
    graph = nx.DiGraph()
    graph.add_nodes_from(node.id for node in dataset.nodes)
    graph.add_edges_from((edge.source, edge.target) for edge in dataset.edges)
    return graph


def _require_finite_range(
    value: float,
    name: str,
    *,
    lower: float | None = None,
    upper: float | None = None,
    strict_lower: bool = False,
) -> None:
    if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value):
        raise ValueError(f"{name} must be a finite number")
    if lower is not None:
        if strict_lower and value <= lower:
            raise ValueError(f"{name} must be > {lower:g}")
        if not strict_lower and value < lower:
            raise ValueError(f"{name} must be >= {lower:g}")
    if upper is not None and value > upper:
        raise ValueError(f"{name} must be <= {upper:g}")


def validate_dataset(dataset: DatasetPayload) -> ValidationResponse:
    node_ids = [node.id for node in dataset.nodes]
    if len(node_ids) != len(set(node_ids)):
        raise ValueError("Node identifiers must be unique")

    for node in dataset.nodes:
        _require_finite_range(node.B, "B", lower=0.0, upper=1.0)

    node_set = set(node_ids)
    pairs: set[tuple[str, str]] = set()
    for edge in dataset.edges:
        if edge.source not in node_set or edge.target not in node_set:
            raise ValueError(
                f"Edge {edge.source}->{edge.target} references an unknown node"
            )
        pair = (edge.source, edge.target)
        if pair in pairs:
            raise ValueError(f"Duplicate directed edge: {edge.source}->{edge.target}")
        pairs.add(pair)

        _require_finite_range(edge.tau, "tau", lower=0.0, upper=1.0)
        has_s = edge.S is not None
        has_l = edge.L is not None
        has_c = edge.C is not None
        if has_s and (has_l or has_c):
            raise ValueError(
                "Ambiguous edge susceptibility input: provide either explicit S "
                "or primitive L and C, not both"
            )
        if has_l != has_c:
            raise ValueError("L and C must be provided together")
        if has_s:
            _require_finite_range(edge.S, "S", lower=0.0, upper=1.0)
        elif has_l and has_c:
            _require_finite_range(edge.L, "L", lower=0.0)
            _require_finite_range(edge.C, "C", lower=0.0, strict_lower=True)
        else:
            raise ValueError("Provide S or both L and C")

    graph = _graph(dataset)
    if not nx.is_directed_acyclic_graph(graph):
        raise ValueError("GBBRPM v1 requires a directed acyclic graph")

    return ValidationResponse(
        valid=True,
        node_count=len(node_ids),
        edge_count=len(dataset.edges),
        source_count=sum(graph.in_degree(node_id) == 0 for node_id in graph.nodes),
        outlet_count=sum(node.outlet for node in dataset.nodes),
        topological_order=list(nx.topological_sort(graph)),
    )


def _optional_number(value: float) -> float | None:
    return None if math.isnan(value) else value


def evaluate_dataset(dataset: DatasetPayload) -> EvaluationResponse:
    validation = validate_dataset(dataset)
    nodes = pd.DataFrame(
        [{"node": node.id, "B": node.B} for node in dataset.nodes]
    )
    edge_rows = []
    for edge in dataset.edges:
        row = {
            "source": edge.source,
            "target": edge.target,
            "tau": edge.tau,
        }
        if edge.L is not None:
            row["L"] = edge.L
        if edge.C is not None:
            row["C"] = edge.C
        if edge.S is not None:
            row["S"] = edge.S
        edge_rows.append(row)

    risks, contribution_frame = evaluate_gbbrpm(nodes, pd.DataFrame(edge_rows))
    ranked = sorted(risks.items(), key=lambda item: (-item[1], item[0]))
    ranks = {node_id: index + 1 for index, (node_id, _) in enumerate(ranked)}
    nodes_by_id = {node.id: node for node in dataset.nodes}

    risk_records = [
        RiskRecord(
            id=node_id,
            risk=float(risk),
            rank=ranks[node_id],
            local_disturbance=nodes_by_id[node_id].B,
            outlet=nodes_by_id[node_id].outlet,
        )
        for node_id, risk in ranked
    ]
    contributions = [
        EdgeContribution(
            source=str(row.source),
            target=str(row.target),
            R_source=float(row.R_source),
            S=float(row.S),
            tau=float(row.tau),
            Q=float(row.Q),
            L=_optional_number(float(row.L)),
            C=_optional_number(float(row.C)),
            u=_optional_number(float(row.u)),
        )
        for row in contribution_frame.itertuples(index=False)
    ]
    outlet_risks = {
        node.id: float(risks[node.id]) for node in dataset.nodes if node.outlet
    }
    # Read the engine's computed values; never duplicate its formula here.
    incoming = {node_id: [] for node_id in validation.topological_order}
    for contribution in contributions:
        incoming[contribution.target].append(contribution)
    trace = []
    for node_id in validation.topological_order:
        common = {"node": node_id, "B": nodes_by_id[node_id].B,
                  "risk": float(risks[node_id])}
        for contribution in incoming[node_id]:
            trace.append(EvaluationStep(type="transfer", contribution=contribution, **common))
        trace.append(EvaluationStep(
            type="aggregate" if incoming[node_id] else "source", **common,
        ))

    return EvaluationResponse(
        dataset_id=dataset.id,
        mode=dataset.mode,
        provenance=dataset.source_note or f"{dataset.mode.value} dataset",
        risks=risk_records,
        contributions=contributions,
        topological_order=validation.topological_order,
        trace=trace,
        summary=EvaluationSummary(
            highest_risk_node=ranked[0][0],
            highest_risk=float(ranked[0][1]),
            outlet_risks=outlet_risks,
            node_count=validation.node_count,
            edge_count=validation.edge_count,
        ),
        metadata={
            "source_count": validation.source_count,
            "outlet_count": validation.outlet_count,
        },
    )
