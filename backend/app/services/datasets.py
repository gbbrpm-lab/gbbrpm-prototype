from functools import lru_cache
from pathlib import Path

import pandas as pd

from app.models import (
    DatasetMode,
    DatasetPayload,
    DatasetSummary,
    EdgeRecord,
    NodeRecord,
)


DATA_DIR = Path(__file__).resolve().parents[2] / "data"
NODES_FILE = DATA_DIR / "synthetic_nodes.csv"
EDGES_FILE = DATA_DIR / "synthetic_edges.csv"

NETWORK_DESCRIPTIONS = {
    "N1": "Linear propagation chain",
    "N2": "Branching network",
    "N3": "Converging multi-source network",
    "N4": "Diamond reconvergence network",
    "N5": "Mixed 20-node benchmark network",
}


@lru_cache(maxsize=1)
def load_synthetic_datasets() -> dict[str, DatasetPayload]:
    nodes = pd.read_csv(NODES_FILE)
    edges = pd.read_csv(EDGES_FILE)
    datasets: dict[str, DatasetPayload] = {}

    for network in sorted(nodes["network"].unique()):
        network_nodes = nodes.loc[nodes["network"] == network]
        network_edges = edges.loc[edges["network"] == network]
        datasets[network] = DatasetPayload(
            id=network,
            name=f"Synthetic {network}",
            mode=DatasetMode.SYNTHETIC,
            description=NETWORK_DESCRIPTIONS[network],
            source_note="Frozen N1-N5 thesis validation fixture",
            nodes=[
                NodeRecord(
                    id=str(row.node),
                    label=str(row.node),
                    B=float(row.B),
                    outlet=bool(row.outlet),
                )
                for row in network_nodes.itertuples(index=False)
            ],
            edges=[
                EdgeRecord(
                    source=str(row.source),
                    target=str(row.target),
                    L=float(row.L),
                    C=float(row.C),
                    tau=float(row.tau),
                )
                for row in network_edges.itertuples(index=False)
            ],
        )

    return datasets


def list_datasets() -> list[DatasetSummary]:
    return [
        DatasetSummary(
            id=dataset.id,
            name=dataset.name,
            mode=dataset.mode,
            description=dataset.description,
            node_count=len(dataset.nodes),
            edge_count=len(dataset.edges),
        )
        for dataset in load_synthetic_datasets().values()
    ]


def get_dataset(dataset_id: str) -> DatasetPayload | None:
    return load_synthetic_datasets().get(dataset_id.upper())

