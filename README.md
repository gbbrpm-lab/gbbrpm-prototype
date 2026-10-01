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
- Named scenario save/load with exact inputs, evaluated outputs, and model metadata
- Browser-local scenario rename, deletion, and baseline promotion
- Pinned GBBRPM `v0.1.0` dependency
- Optional evaluation walkthrough with continuous pipelined edge pulses, smooth
  node/edge transitions, persistent flowing edge dashes, and a live calculation panel
- Play/pause, event-boundary previous/next, speed, restart, replay, and skip-to-results controls
- Incoming-contribution inspection and backend-derived susceptibility values
- Explicit `S` editing for imported networks without `L`/`C`
- Synchronized graph selection from the ranking and comparison views
- Inspector and ranking remain accessible below the graph on narrow screens

Operational mode is intentionally inactive until an agency dataset is mapped
and documented. This prevents demonstration fixtures from being mistaken for
real infrastructure observations.

## Evaluation walkthrough

1. Enable **Animate evaluation after Run**, then click **Run model**. Initial
   dataset loading remains instant; animation is off by default.
2. Each node starts the moment its predecessors settle. Contributions travel
   along their edges as continuous pulses while other branches already advance,
   so independent paths progress in parallel on one live clock instead of
   snapping through layers. Nodes that become ready together are staggered
   slightly so the frontier spreads visibly. An edge that starts transmitting
   keeps its flowing dashes for the rest of the walkthrough, so established
   channels stay visibly in motion until the walkthrough is closed.
3. Read the step panel for `Q = S × tau × R_source` and
   `R = 1 − (1 − B) × product(1 − Q)`. Both values tick up live while the step
   computes and land exactly on the backend engine's outputs when it settles;
   the frontend does not evaluate the model again.
4. Pause or use **Previous**/**Next** to jump between event boundaries; the
   progress bar tracks seconds elapsed. **Restart**
   returns to the beginning paused; **Skip to results** reveals the final graph
   and ranking. **Replay last evaluation** needs no new API call.
5. Editing parameters or changing datasets cancels the walkthrough. Existing
   stale-result warnings still apply until a fresh evaluation completes.

This animation represents a valid topological **calculation order**, not
physical travel time, flow speed, or stochastic event timing. Independent
branches advance in parallel because neither depends on the other; this
simultaneity does not imply that two physical branches travel at the same speed.
At convergence, every
incoming contribution is shown before the target is revealed. A zero-valued
contribution is still a calculation step, not a positive transfer of risk.

Reduced-motion preferences suppress moving edge dashes and start the walkthrough
paused for manual navigation. Final ranking remains hidden during the walkthrough
but complete evaluated results stay available in scenario comparison and exports.

Select a node to inspect its incoming `Q` values. Select an edge to inspect
the engine's actual `S`, `tau`, `R_source`, and `Q`. Primitive `L`/`C` inputs
continue to take precedence when both are supplied; explicit `S` inputs are
editable without introducing artificial `L`/`C` values.

When copying this source update into an existing checkout, replace the source
files while preserving your `.git`, backend `.venv`, frontend `node_modules`, and
local environment settings. Restart the backend and frontend together: the new
walkthrough requires the backend's additive `trace` and `topological_order`
response fields. Existing browser-local scenarios remain compatible and are
reevaluated on load. The model dependency and calculation engine are unchanged.

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

## Named scenario workflow

1. Load or modify a network and run the model.
2. Enter a scenario name under **Saved scenarios** and save the clean evaluation.
3. Use **Load** to restore its exact inputs. The backend reevaluates those inputs
   before presenting results, so stored output is not accepted without verification.
4. Use **Baseline** to load and promote a saved scenario as the comparison
   reference, then load another compatible saved scenario to compare them.
5. Rename or delete entries as the scenario library evolves.

Named scenarios use versioned browser-local storage and remain on the current
browser/profile. They are convenient workspace drafts, not portable evidence.
Use the JSON analysis manifest when a run must be archived, transferred, or
cited in the research record. Only clean, evaluated scenarios can be saved.

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
├── scripts/
│   └── dev.mjs
├── package.json
└── README.md
```

## Prerequisites

- Python 3.11 or newer
- Node.js 20 or newer
- Git, because the backend installs the tagged model from GitHub

## Quick start

One-time setup is required before the first run: the backend needs its virtual
environment and Python packages, and the frontend needs its npm packages.

### One-time setup

```powershell
# backend (from the repository root)
cd backend
py -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
cd ..

# frontend
cd frontend
npm install
cd ..
```

On WSL / Ubuntu use `python3 -m venv .venv`, `source .venv/bin/activate`, and
`pip install -r requirements-dev.txt` instead.

### Run both together

```bash
npm run dev
```

This single command starts the backend and the frontend with prefixed log
output:

| Service | URL |
| --- | --- |
| Frontend | `http://localhost:5173` |
| Backend API | `http://localhost:8000` |
| API documentation | `http://localhost:8000/docs` |

Press `Ctrl+C` once to stop both processes.

Other root commands:

```bash
npm run dev:backend    # backend only
npm run dev:frontend   # frontend only
npm run build          # production build (tsc -b && vite build)
npm run preview        # preview the production build
npm run test           # frontend unit tests
```

The root `npm run dev` expects `frontend/node_modules` to exist (run
`npm install` in `frontend/` once) and a backend virtual environment at
`backend/.venv` (created during one-time setup).

## Backend setup (manual)

### Windows PowerShell

```powershell
cd backend
py -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
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
python -m pytest -q
```

## Frontend setup (manual)

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
