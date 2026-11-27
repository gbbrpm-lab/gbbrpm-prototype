from fastapi.testclient import TestClient
import pytest

from app.main import app


client = TestClient(app)


def test_health_and_dataset_inventory():
    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json()["model_version"] == "0.1.0"

    response = client.get("/api/datasets")
    assert response.status_code == 200
    datasets = response.json()
    assert [dataset["id"] for dataset in datasets] == ["N1", "N2", "N3", "N4", "N5"]
    assert datasets[-1]["node_count"] == 20


def test_n5_reproduces_frozen_outlet_risk():
    dataset = client.get("/api/datasets/N5").json()
    response = client.post("/api/evaluate", json=dataset)
    assert response.status_code == 200
    result = response.json()
    assert abs(result["summary"]["outlet_risks"]["N20"] - 0.7086404493) < 5e-7
    assert result["risks"][0]["id"] == "N13"


def test_invalid_import_is_rejected():
    payload = {
        "id": "bad-import",
        "name": "Bad import",
        "mode": "imported",
        "nodes": [{"id": "A", "B": 0.2}],
        "edges": [{"source": "A", "target": "UNKNOWN", "S": 0.5}],
    }
    response = client.post("/api/datasets/validate", json=payload)
    assert response.status_code == 422
    assert "unknown node" in response.json()["detail"]


def test_valid_explicit_s_import_uses_shared_evaluation_path():
    payload = {
        "id": "import-example",
        "name": "Imported example",
        "mode": "imported",
        "source_note": "Test fixture",
        "nodes": [
            {"id": "A", "B": 0.8, "outlet": False},
            {"id": "B", "B": 0.0, "outlet": False},
            {"id": "C", "B": 0.0, "outlet": True},
        ],
        "edges": [
            {"source": "A", "target": "B", "S": 0.5, "tau": 1.0},
            {"source": "B", "target": "C", "S": 0.7, "tau": 1.0},
        ],
    }
    validation = client.post("/api/datasets/validate", json=payload)
    assert validation.status_code == 200
    assert validation.json()["topological_order"] == ["A", "B", "C"]

    response = client.post("/api/evaluate", json=payload)
    assert response.status_code == 200
    result = response.json()
    assert abs(result["summary"]["outlet_risks"]["C"] - 0.28) < 1e-12
    assert result["mode"] == "imported"


@pytest.mark.parametrize("dataset_id", ["N1", "N2", "N3", "N4", "N5"])
def test_trace_is_deterministic_and_matches_engine_results(dataset_id):
    dataset = client.get(f"/api/datasets/{dataset_id}").json()
    result = client.post("/api/evaluate", json=dataset).json()
    assert result == client.post("/api/evaluate", json=dataset).json()
    risks = {row["id"]: row for row in result["risks"]}
    order = result["topological_order"]
    assert len(result["trace"]) == len(dataset["nodes"]) + len(dataset["edges"])
    evaluated = set()
    transferred = []
    for step in result["trace"]:
        assert step["risk"] == risks[step["node"]]["risk"]
        assert step["B"] == risks[step["node"]]["local_disturbance"]
        if step["type"] == "transfer":
            edge = step["contribution"]
            assert edge["source"] in evaluated
            assert step["node"] == edge["target"]
            assert order.index(edge["source"]) < order.index(edge["target"])
            assert edge in result["contributions"]
            transferred.append(edge)
        else:
            incoming = [edge for edge in result["contributions"] if edge["target"] == step["node"]]
            assert all(edge in transferred for edge in incoming)
            assert step["type"] == ("aggregate" if incoming else "source")
            evaluated.add(step["node"])
    assert evaluated == set(order)
    assert transferred == result["contributions"]


@pytest.mark.parametrize(
    "endpoint", ["/api/datasets/validate", "/api/evaluate"]
)
@pytest.mark.parametrize(
    "raw_value", ["Infinity", "-Infinity", "NaN", '"inf"', '"-inf"', '"NaN"']
)
@pytest.mark.parametrize(
    "target_field", ["B", "L", "C", "S", "tau"]
)
def test_nonfinite_values_rejected_with_422(endpoint, raw_value, target_field):
    if target_field == "B":
        body = (
            '{"id":"nf","name":"NF","mode":"imported",'
            f'"nodes":[{{"id":"A","B":{raw_value}}},{{"id":"B","B":0.0}}],'
            '"edges":[{"source":"A","target":"B","S":0.5,"tau":1.0}]}'
        )
    elif target_field == "L":
        body = (
            '{"id":"nf","name":"NF","mode":"imported",'
            '"nodes":[{"id":"A","B":0.5},{"id":"B","B":0.0}],'
            f'"edges":[{{"source":"A","target":"B","L":{raw_value},"C":100.0,"tau":1.0}}]}}'
        )
    elif target_field == "C":
        body = (
            '{"id":"nf","name":"NF","mode":"imported",'
            '"nodes":[{"id":"A","B":0.5},{"id":"B","B":0.0}],'
            f'"edges":[{{"source":"A","target":"B","L":50.0,"C":{raw_value},"tau":1.0}}]}}'
        )
    elif target_field == "S":
        body = (
            '{"id":"nf","name":"NF","mode":"imported",'
            '"nodes":[{"id":"A","B":0.5},{"id":"B","B":0.0}],'
            f'"edges":[{{"source":"A","target":"B","S":{raw_value},"tau":1.0}}]}}'
        )
    else:
        body = (
            '{"id":"nf","name":"NF","mode":"imported",'
            '"nodes":[{"id":"A","B":0.5},{"id":"B","B":0.0}],'
            f'"edges":[{{"source":"A","target":"B","S":0.5,"tau":{raw_value}}}]}}'
        )

    response = client.post(
        endpoint,
        content=body,
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 422


@pytest.mark.parametrize(
    "endpoint", ["/api/datasets/validate", "/api/evaluate"]
)
@pytest.mark.parametrize(
    "edge_payload",
    [
        {"source": "A", "target": "B", "S": 0.5, "L": 50.0, "C": 100.0},
        {"source": "A", "target": "B", "S": 0.5, "L": 50.0},
        {"source": "A", "target": "B", "S": 0.5, "C": 100.0},
    ],
)
def test_dual_s_and_lc_rejected_with_422(endpoint, edge_payload):
    payload = {
        "id": "dual-input",
        "name": "Dual input",
        "mode": "imported",
        "nodes": [{"id": "A", "B": 0.5}, {"id": "B", "B": 0.0}],
        "edges": [edge_payload],
    }
    response = client.post(endpoint, json=payload)
    assert response.status_code == 422


def test_service_layer_rejects_unvalidated_nonfinite_and_dual_inputs():
    from app.models import DatasetMode, DatasetPayload, EdgeRecord, NodeRecord
    from app.services.evaluation import evaluate_dataset, validate_dataset

    dual_dataset = DatasetPayload.model_construct(
        id="dual",
        name="Dual",
        mode=DatasetMode.IMPORTED,
        nodes=[
            NodeRecord.model_construct(id="A", B=0.5, outlet=False, label=None),
            NodeRecord.model_construct(id="B", B=0.0, outlet=True, label=None),
        ],
        edges=[
            EdgeRecord.model_construct(
                source="A", target="B", L=50.0, C=100.0, S=0.5, tau=1.0
            )
        ],
    )
    with pytest.raises(ValueError, match="Ambiguous"):
        validate_dataset(dual_dataset)
    with pytest.raises(ValueError, match="Ambiguous"):
        evaluate_dataset(dual_dataset)

    inf_dataset = DatasetPayload.model_construct(
        id="inf",
        name="Inf",
        mode=DatasetMode.IMPORTED,
        nodes=[
            NodeRecord.model_construct(id="A", B=0.5, outlet=False, label=None),
            NodeRecord.model_construct(id="B", B=0.0, outlet=True, label=None),
        ],
        edges=[
            EdgeRecord.model_construct(
                source="A", target="B", L=float("inf"), C=100.0, S=None, tau=1.0
            )
        ],
    )
    with pytest.raises(ValueError, match="L"):
        validate_dataset(inf_dataset)
    with pytest.raises(ValueError, match="L"):
        evaluate_dataset(inf_dataset)
