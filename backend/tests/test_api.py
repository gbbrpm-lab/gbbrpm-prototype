from fastapi.testclient import TestClient

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
