import { useState, useEffect } from "react";
import api from "../../services/api";
import Icon from "../Icon";
import { Button, Panel } from "./ui";
import { errorMessage } from "./adminUtils";

const inputClass =
  "flex-1 min-w-0 px-3 py-2 text-sm bg-surface-container-low text-on-surface rounded-xl border border-transparent focus:outline-none focus:border-primary focus:bg-surface-container-lowest";

const byName = (a, b) => a.name.localeCompare(b.name);

export default function AreasTab({ onChange }) {
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  useEffect(() => {
    const fetchAreas = async () => {
      try {
        const res = await api.get("/admin/areas");
        setAreas(res.data.data);
      } catch (err) {
        console.error(err);
        setError(errorMessage(err, "Failed to load areas"));
      } finally {
        setLoading(false);
      }
    };
    fetchAreas();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    try {
      setAdding(true);
      setAddError("");
      const res = await api.post("/add-area", { area: trimmed });
      // a new area has nothing pointing at it yet
      const area = { ...res.data.data, _count: { volunteers: 0, rescuePosts: 0 } };
      setAreas((prev) => [...prev, area].sort(byName));
      setName("");
      onChange();
    } catch (err) {
      console.error(err);
      setAddError(errorMessage(err, "Failed to add area"));
    } finally {
      setAdding(false);
    }
  };

  const handleRenamed = (updated) => {
    setAreas((prev) => prev.map((a) => (a.id === updated.id ? updated : a)).sort(byName));
    onChange();
  };

  const handleDeleted = (id) => {
    setAreas((prev) => prev.filter((a) => a.id !== id));
    onChange();
  };

  return (
    <Panel title="Rescue areas" description="Volunteers pick an area and every rescue post belongs to one.">
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (addError) setAddError("");
          }}
          className={inputClass}
          placeholder="New area name, e.g. Mirpur"
          aria-label="New area name"
        />
        <button
          type="submit"
          disabled={adding || !name.trim()}
          className="inline-flex items-center gap-1 px-4 py-2 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-primary-container disabled:opacity-50"
        >
          <Icon name="add" className="text-[18px]" />
          {adding ? "Adding..." : "Add area"}
        </button>
      </form>
      {addError && <p className="mt-1.5 text-sm text-error">{addError}</p>}

      {loading ? (
        <p className="py-10 text-center text-sm text-on-surface-variant">Loading...</p>
      ) : error ? (
        <div className="mt-4 p-4 bg-error-container rounded-xl">
          <p className="text-sm text-on-error-container">{error}</p>
        </div>
      ) : areas.length === 0 ? (
        <p className="py-10 text-center text-sm text-on-surface-variant">No areas added yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-surface-container-high">
          {areas.map((area) => (
            <AreaRow key={area.id} area={area} onRenamed={handleRenamed} onDeleted={handleDeleted} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function AreaRow({ area, onRenamed, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(area.name);
  const [busy, setBusy] = useState(false);
  const inUse = area._count.volunteers > 0 || area._count.rescuePosts > 0;

  const save = async (e) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || trimmed === area.name) {
      setEditing(false);
      return;
    }

    try {
      setBusy(true);
      const res = await api.patch(`/admin/areas/${area.id}`, { name: trimmed });
      onRenamed(res.data.data);
      setEditing(false);
    } catch (err) {
      console.error(err);
      alert(errorMessage(err, "Failed to rename area"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete the area "${area.name}"?`)) return;

    try {
      setBusy(true);
      await api.delete(`/admin/areas/${area.id}`);
      onDeleted(area.id);
    } catch (err) {
      console.error(err);
      alert(errorMessage(err, "Failed to delete area"));
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <li className="py-3">
        <form onSubmit={save} className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className={inputClass}
            aria-label="Area name"
            autoFocus
          />
          <Button type="submit" variant="primary" disabled={busy || !draft.trim()}>
            {busy ? "Saving..." : "Save"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setDraft(area.name);
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </form>
      </li>
    );
  }

  return (
    <li className="py-3 flex items-center gap-3">
      <Icon name="location_on" className="text-[20px] text-primary shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-on-surface truncate">{area.name}</p>
        <p className="text-xs text-on-surface-variant">
          {area._count.volunteers} volunteers · {area._count.rescuePosts} posts
        </p>
      </div>
      <Button variant="ghost" icon="edit" onClick={() => setEditing(true)}>
        Rename
      </Button>
      <Button
        variant="danger"
        icon="delete"
        disabled={busy || inUse}
        title={inUse ? "Areas in use by volunteers or posts can't be deleted" : undefined}
        onClick={remove}
      >
        Delete
      </Button>
    </li>
  );
}
