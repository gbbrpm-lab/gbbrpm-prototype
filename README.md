# GBBRPM Prototype

Interactive research prototype for the **Graph-Based Blockage Risk Propagation
Model (GBBRPM)**. The application provides one validated workflow for
controlled synthetic fixtures, future operational records, and user-imported
networks without presenting synthetic data as operational evidence.

The backend uses the tagged model implementation from
[`gbbrpm-experiments@v0.1.0`](https://github.com/gbbrpm-lab/gbbrpm-experiments/tree/v0.1.0).

## Current milestone

- Synthetic N1–N5 dataset selection
- Operational-data placeholder with explicit availability status
- JSON import using the common dataset schema
- Node, edge, bounds, endpoint, duplicate, and DAG validation
- Interactive directed-network visualization
- Node disturbance `B` editing
- Edge `L`, `C`, and transmission `tau` editing
- Live GBBRPM evaluation and propagated-risk coloring
- Ranked component table and outlet-risk summary
- Baseline-versus-candidate scenario comparison
- Per-component risk deltas and ranking movement
- Explicit stale-result warning after parameter edits
- CSV comparison export for analysis and thesis tables
- JSON reproducibility manifest with inputs, outputs, provenance, and model version
- Pinned GBBRPM `v0.1.0` dependency

Operational mode is intentionally inactive until an agency dataset is mapped
and documented. This prevents demonstration fixtures from being mistaken for
real infrastructure observations.

## Scenario comparison workflow

1. Load a synthetic or imported network. Its first successful evaluation is
   retained automatically as the baseline.
2. Select a node or edge and modify `B`, `L`, `C`, or `tau`.
3. Run the model to evaluate the candidate scenario. Until then, the interface
   marks the displayed evaluation as stale.
4. Open **Scenario comparison** to inspect risk deltas, ranking movement, the
   largest modeled-risk increase, and the mean absolute change.
5. Use **Save baseline** to promote any clean evaluated scenario as the new
   reference point for subsequent comparisons.
6. Export the comparison as CSV or download the full JSON analysis manifest.

Export is disabled while parameters have unevaluated changes. This guarantees
that downloaded candidate inputs correspond to the included model outputs.

### Exported records

The CSV contains one record per node with the dataset and component IDs,
outlet flag, baseline and current risk, risk delta, baseline and current rank,
and rank movement. Values retain their full numeric precision.

The JSON manifest uses schema version `1.0` and includes:

- GBBRPM model version and evidence boundary;
- dataset mode, source note, and evaluator provenance;
- complete baseline dataset and evaluation;
- complete candidate dataset and evaluation; and
- the same comparison rows and summary displayed by the interface.

The comparison reports changes in the bounded modeled risk index. It does not
interpret those changes as probabilities or direct predictions of real-world
failure or flooding.

## Architecture

```text
Synthetic CSV ─┐
Operational ───┼─> Common schema ─> Validation ─> GBBRPM v0.1.0 ─> Results
Imported JSON ─┘                                           │
                                                          └─> React graph UI
```

```text
gbbrpm-prototype/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── models.py
│   │   └── services/
│   ├── data/
│   ├── tests/
│   ├── requirements.txt
│   └── requirements-dev.txt
├── frontend/
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── examples/
│   └── imported-network.json
└── README.md
```

## Prerequisites

- Python 3.11 or newer
- Node.js 20 or newer
- Git, because the backend installs the tagged model from GitHub

## Backend setup

### Windows PowerShell

```powershell
cd backend
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

### WSL / Ubuntu

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

The API runs at `http://localhost:8000`. Interactive API documentation is at
`http://localhost:8000/docs`.

Run backend tests from `backend/`:

```bash
pytest -q
```

## Frontend setup

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

For a production compilation check:

```bash
npm run build
```

## Common dataset schema

Every source is converted into a `DatasetPayload` before evaluation.

### Nodes

| Field | Type | Rule |
| --- | --- | --- |
| `id` | string | Unique, non-empty component identifier |
| `B` | number | Local disturbance in `[0,1]` |
| `outlet` | boolean | Marks an outlet or terminal component for reporting |
| `label` | string | Optional display label |

### Edges

| Field | Type | Rule |
| --- | --- | --- |
| `source` | string | Must reference a declared node |
| `target` | string | Must reference a declared node |
| `L`, `C` | number | Optional primitive pair; `L >= 0`, `C > 0` |
| `S` | number | Required only when `L/C` is not supplied; bounded in `[0,1]` |
| `tau` | number | Optional transmission factor in `[0,1]`; defaults to `1` |

The graph must be a directed acyclic graph and cannot contain duplicate node
identifiers or duplicate directed edges. See
[`examples/imported-network.json`](examples/imported-network.json) for a valid
import file.

## API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Backend and model-version status |
| `GET` | `/api/datasets` | Available built-in dataset summaries |
| `GET` | `/api/datasets/{id}` | Full synthetic dataset payload |
| `POST` | `/api/datasets/validate` | Validate imported or adapted data |
| `POST` | `/api/evaluate` | Validate and evaluate a network |

## Evidence boundary

The interface is a decision-support research prototype. A displayed value is a
bounded modeled risk index, not a probability or direct flood prediction.
Synthetic fixtures demonstrate controlled structural behavior. Future
operational records require documented attribute mapping, provenance, data
quality review, and comparison with observed conditions before they can support
application-level conclusions.
