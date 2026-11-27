from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class DatasetMode(StrEnum):
    SYNTHETIC = "synthetic"
    OPERATIONAL = "operational"
    IMPORTED = "imported"


class NodeRecord(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str = Field(min_length=1)
    B: float = Field(ge=0.0, le=1.0, allow_inf_nan=False)
    outlet: bool = False
    label: str | None = None


class EdgeRecord(BaseModel):
    model_config = ConfigDict(extra="allow")

    source: str = Field(min_length=1)
    target: str = Field(min_length=1)
    L: float | None = Field(default=None, ge=0.0, allow_inf_nan=False)
    C: float | None = Field(default=None, gt=0.0, allow_inf_nan=False)
    S: float | None = Field(default=None, ge=0.0, le=1.0, allow_inf_nan=False)
    tau: float = Field(default=1.0, ge=0.0, le=1.0, allow_inf_nan=False)

    @model_validator(mode="after")
    def require_susceptibility_input(self):
        has_s = self.S is not None
        has_l = self.L is not None
        has_c = self.C is not None
        has_any_primitive = has_l or has_c
        has_both_primitives = has_l and has_c

        if has_s and has_any_primitive:
            raise ValueError(
                "Ambiguous edge susceptibility input: provide either explicit S "
                "or primitive L and C, not both"
            )
        if has_l != has_c:
            raise ValueError("L and C must be provided together")
        if not has_s and not has_both_primitives:
            raise ValueError("Provide S or both L and C")
        return self


class DatasetPayload(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    mode: DatasetMode
    description: str = ""
    source_note: str = ""
    nodes: list[NodeRecord] = Field(min_length=1)
    edges: list[EdgeRecord] = Field(min_length=1)


class DatasetSummary(BaseModel):
    id: str
    name: str
    mode: DatasetMode
    description: str
    node_count: int
    edge_count: int


class ValidationResponse(BaseModel):
    valid: bool
    node_count: int
    edge_count: int
    source_count: int
    outlet_count: int
    topological_order: list[str]


class RiskRecord(BaseModel):
    id: str
    risk: float
    rank: int
    local_disturbance: float
    outlet: bool


class EdgeContribution(BaseModel):
    source: str
    target: str
    R_source: float
    S: float
    tau: float
    Q: float
    L: float | None = None
    C: float | None = None
    u: float | None = None


class EvaluationSummary(BaseModel):
    highest_risk_node: str
    highest_risk: float
    outlet_risks: dict[str, float]
    node_count: int
    edge_count: int


class EvaluationStep(BaseModel):
    """A walkthrough of returned results, not a second model evaluation."""

    type: Literal["source", "transfer", "aggregate"]
    node: str
    B: float
    risk: float
    contribution: EdgeContribution | None = None


class EvaluationResponse(BaseModel):
    dataset_id: str
    mode: DatasetMode
    provenance: str
    risks: list[RiskRecord]
    contributions: list[EdgeContribution]
    topological_order: list[str] = Field(default_factory=list)
    trace: list[EvaluationStep] = Field(default_factory=list)
    summary: EvaluationSummary
    metadata: dict[str, Any] = Field(default_factory=dict)
