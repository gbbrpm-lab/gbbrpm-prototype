import { BookmarkPlus, Flag, FolderOpen, Pencil, Save, Trash2, X } from "lucide-react";
import { useState } from "react";

import type { SavedScenario } from "../types";

interface Props {
  scenarios: SavedScenario[];
  canSave: boolean;
  defaultName: string;
  onSave: (name: string) => void;
  onLoad: (scenario: SavedScenario) => void;
  onUseAsBaseline: (scenario: SavedScenario) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

function savedTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function SavedScenarios({
  scenarios,
  canSave,
  defaultName,
  onSave,
  onLoad,
  onUseAsBaseline,
  onRename,
  onDelete,
}: Props) {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  function save() {
    onSave(name.trim() || defaultName);
    setName("");
  }

  function finishRename() {
    if (!editingId || !editingName.trim()) return;
    onRename(editingId, editingName.trim());
    setEditingId(null);
    setEditingName("");
  }

  return (
    <section className="saved-scenarios">
      <div className="saved-heading">
        <div>
          <p className="eyebrow">Saved scenarios</p>
          <span>Browser-local workspace</span>
        </div>
        <strong>{scenarios.length}</strong>
      </div>

      <div className="scenario-save-row">
        <input
          aria-label="Scenario name"
          placeholder={defaultName || "Scenario name"}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && canSave) save();
          }}
        />
        <button disabled={!canSave} onClick={save} title="Save current evaluated scenario">
          <BookmarkPlus size={14} />
        </button>
      </div>

      {!canSave && <p className="saved-hint">Run the current inputs before saving.</p>}

      <div className="saved-list">
        {scenarios.length === 0 && (
          <div className="saved-empty"><Save size={16} />No saved scenarios yet</div>
        )}
        {scenarios.map((scenario) => (
          <article className="saved-item" key={scenario.id}>
            {editingId === scenario.id ? (
              <div className="scenario-rename">
                <input
                  autoFocus
                  aria-label="Rename scenario"
                  value={editingName}
                  onChange={(event) => setEditingName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") finishRename();
                    if (event.key === "Escape") setEditingId(null);
                  }}
                />
                <button onClick={finishRename} title="Save name"><Save size={12} /></button>
                <button onClick={() => setEditingId(null)} title="Cancel"><X size={12} /></button>
              </div>
            ) : (
              <div className="saved-item-title">
                <div><strong>{scenario.name}</strong><small>{scenario.snapshot.dataset.id} · {savedTime(scenario.savedAt)}</small></div>
                <button
                  onClick={() => {
                    setEditingId(scenario.id);
                    setEditingName(scenario.name);
                  }}
                  title="Rename scenario"
                ><Pencil size={11} /></button>
              </div>
            )}
            <div className="saved-item-actions">
              <button onClick={() => onLoad(scenario)}><FolderOpen size={12} /> Load</button>
              <button onClick={() => onUseAsBaseline(scenario)} title="Use saved evaluation as comparison baseline"><Flag size={12} /> Baseline</button>
              <button className="delete" onClick={() => onDelete(scenario.id)} title="Delete scenario"><Trash2 size={12} /></button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
