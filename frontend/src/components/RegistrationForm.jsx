// frontend/src/components/RegistrationForm.jsx
import { useState, useEffect } from "react";
import { autocomplete, registerBook } from "../api/books";
import { previewBySize } from "../api/bmarks";
import { useAppContext } from "../context/AppContext";

export default function RegistrationForm({ onRegistered }) {
  const { refreshBooks } = useAppContext();

  const [form, setForm] = useState({
    BBreite: "",
    BHoehe: "",
    BAutor: "",
    BKw: "",
    BKP: 1,
    BKw1: "",
    BK1P: "",
    BKw2: "",
    BK2P: "",
    BVerlag: "",
    BSeiten: "",
    BTop: false,
  });

  const [suggestedMark, setSuggestedMark] = useState(null);
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState({
    BAutor: [],
    BKw: [],
    BKw1: [],
    BKw2: [],
    BVerlag: [],
  });

  // Live preview (no submit needed)
  useEffect(() => {
    const w = form.BBreite?.toString().trim();
    const h = form.BHoehe?.toString().trim();
    if (!w || !h) { setSuggestedMark(null); return; }

    let cancelled = false;
    (async () => {
      try {
        const m = await previewBySize(w.replace(",", "."), h.replace(",", "."));
        // support both shapes: { BMark } and { firstCode }
        const first = m?.BMark || m?.firstCode || null;
        if (!cancelled) setSuggestedMark(first);
      } catch {
        if (!cancelled) setSuggestedMark(null);
      }
    })();

    return () => { cancelled = true; };
  }, [form.BBreite, form.BHoehe]);

  async function handleAutocomplete(field, value) {
    setForm((f) => ({ ...f, [field]: value }));

    const backendField = field === "BKw1" || field === "BKw2" ? "BKw" : field;
    if (value && value.length > 1) {
      try {
        const vals = await autocomplete(backendField, value);
        setSuggestions((s) => ({ ...s, [field]: vals }));
      } catch { /* ignore */ }
    }
  }

  function setField(name) {
    return (e) =>
      setForm((f) => ({
        ...f,
        [name]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
      }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        ...form,
        BBreite: Number(String(form.BBreite).replace(",", ".")),
        BHoehe: Number(String(form.BHoehe).replace(",", ".")),
        BKP: Number(form.BKP || 0),
        BK1P: form.BK1P !== "" ? Number(form.BK1P) : null,
        BK2P: form.BK2P !== "" ? Number(form.BK2P) : null,
        BSeiten: Number(form.BSeiten || 0),
      };

      const saved = await registerBook(payload);
      refreshBooks?.();
      onRegistered && onRegistered(saved);

      setForm({
        BBreite: "",
        BHoehe: "",
        BAutor: "",
        BKw: "",
        BKP: 1,
        BKw1: "",
        BK1P: "",
        BKw2: "",
        BK2P: "",
        BVerlag: "",
        BSeiten: "",
        BTop: false,
      });
      setSuggestedMark(null);
    } catch (err) {
      alert(typeof err === "string" ? err : err?.message || "Fehler beim Speichern");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="p-4 border rounded space-y-3" onSubmit={onSubmit}>
      <h2 className="text-xl font-bold">Register Book</h2>

      <div className="grid gap-2 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span>Breite (BBreite)</span>
          <input
            type="number"
            required
            value={form.BBreite}
            onChange={setField("BBreite")}
            className="border p-2 rounded"
            step="0.1"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span>Höhe (BHoehe)</span>
          <input
            type="number"
            required
            value={form.BHoehe}
            onChange={setField("BHoehe")}
            className="border p-2 rounded"
            step="0.1"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span>Autor (BAutor)</span>
          <input
            list="autor-list"
            required
            value={form.BAutor}
            onChange={(e) => handleAutocomplete("BAutor", e.target.value)}
            className="border p-2 rounded"
          />
          <datalist id="autor-list">
            {suggestions.BAutor.map((v) => <option key={v} value={v} />)}
          </datalist>
        </label>

        <label className="flex flex-col gap-1">
          <span>Stichwort (BKw)</span>
          <input
            list="kw-list"
            required
            maxLength={25}
            value={form.BKw}
            onChange={(e) => handleAutocomplete("BKw", e.target.value)}
            className="border p-2 rounded"
          />
          <datalist id="kw-list">
            {suggestions.BKw.map((v) => <option key={v} value={v} />)}
          </datalist>
        </label>

        <label className="flex flex-col gap-1">
          <span>Position Stichwort (BKP)</span>
          <input
            type="number"
            required
            max={99}
            value={form.BKP}
            onChange={setField("BKP")}
            className="border p-2 rounded"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span>Verlag (BVerlag)</span>
          <input
            list="verlag-list"
            required
            maxLength={25}
            value={form.BVerlag}
            onChange={(e) => handleAutocomplete("BVerlag", e.target.value)}
            className="border p-2 rounded"
          />
          <datalist id="verlag-list">
            {suggestions.BVerlag.map((v) => <option key={v} value={v} />)}
          </datalist>
        </label>

        <label className="flex flex-col gap-1">
          <span>Seiten (BSeiten)</span>
          <input
            type="number"
            required
            max={9999}
            value={form.BSeiten}
            onChange={setField("BSeiten")}
            className="border p-2 rounded"
          />
        </label>

        {/* Optional 2./3. Stichwort */}
        <label className="flex flex-col gap-1">
          <span>2. Stichwort (BKw1)</span>
          <input
            list="kw1-list"
            maxLength={25}
            value={form.BKw1}
            onChange={(e) => handleAutocomplete("BKw1", e.target.value)}
            className="border p-2 rounded"
            placeholder="optional"
          />
          <datalist id="kw1-list">
            {suggestions.BKw1.map((v) => <option key={v} value={v} />)}
          </datalist>
        </label>

        <label className="flex flex-col gap-1">
          <span>Position 2. Stichwort (BK1P)</span>
          <input
            type="number"
            max={99}
            value={form.BK1P}
            onChange={setField("BK1P")}
            className="border p-2 rounded"
            placeholder="optional"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span>3. Stichwort (BKw2)</span>
          <input
            list="kw2-list"
            maxLength={25}
            value={form.BKw2}
            onChange={(e) => handleAutocomplete("BKw2", e.target.value)}
            className="border p-2 rounded"
            placeholder="optional"
          />
          <datalist id="kw2-list">
            {suggestions.BKw2.map((v) => <option key={v} value={v} />)}
          </datalist>
        </label>

        <label className="flex flex-col gap-1">
          <span>Position 3. Stichwort (BK2P)</span>
          <input
            type="number"
            max={99}
            value={form.BK2P}
            onChange={setField("BK2P")}
            className="border p-2 rounded"
            placeholder="optional"
          />
        </label>

        <label className="flex items-center gap-2 mt-1 md:col-span-2">
          <input type="checkbox" checked={form.BTop} onChange={setField("BTop")} />
          <span>Top-Titel (BTop)</span>
        </label>
      </div>

      <div className="text-sm">
        Vorschlag BMark: <strong>{suggestedMark ?? "—"}</strong>
      </div>

      <button disabled={busy} type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
        {busy ? "Speichern…" : "Speichern"}
      </button>
    </form>
  );
}
