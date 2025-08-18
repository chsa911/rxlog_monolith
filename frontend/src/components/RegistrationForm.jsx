// frontend/src/components/RegistrationForm.jsx
import { useState, useEffect } from "react";
import { previewBMark, registerBook } from "@/api/bmarks";
import { autocomplete } from "@/api/books";
import { useAppContext } from "@/context/AppContext";

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
    BVerlag: [],
  });

  // build prefix from size (keep in sync with backend logic)
  function derivePrefix(BBreite, BHoehe) {
    const w = Number(BBreite);
    // Example rule — replace with your real thresholds:
    if (w <= 12.5) return "egk";
    if (w <= 22) return "lgk";
    return "ogk";
  }

  // Live preview best BMark
  useEffect(() => {
    const w = Number(form.BBreite);
    const h = Number(form.BHoehe);
    if (!Number.isFinite(w) || !Number.isFinite(h) || !form.BBreite || !form.BHoehe) {
      setSuggestedMark(null);
      return;
    }
    const prefix = derivePrefix(w, h);
    previewBMark(prefix).then((m) => setSuggestedMark(m?.BMark || null)).catch(() => setSuggestedMark(null));
  }, [form.BBreite, form.BHoehe]);

  // Autocomplete fetch
  async function handleAutocomplete(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (value && value.length > 1) {
      try {
        const vals = await autocomplete(field, value);
        setSuggestions((s) => ({ ...s, [field]: vals }));
      } catch {
        // ignore
      }
    }
  }

  function setField(name) {
    return (e) => setForm((f) => ({ ...f, [name]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      // server will stamp BTopAt if BTop is true in registerBook controller (if you added that)
      const payload = {
        ...form,
        BBreite: Number(form.BBreite),
        BHoehe: Number(form.BHoehe),
        BKP: Number(form.BKP || 0),
        BK1P: form.BK1P ? Number(form.BK1P) : null,
        BK2P: form.BK2P ? Number(form.BK2P) : null,
        BSeiten: Number(form.BSeiten),
      };
      const saved = await registerBook(payload);
      refreshBooks();                 // notify global listeners
      onRegistered && onRegistered(saved);
      // reset minimal fields
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
          <input type="number" required value={form.BBreite} onChange={setField("BBreite")} className="border p-2 rounded" />
        </label>

        <label className="flex flex-col gap-1">
          <span>Höhe (BHoehe)</span>
          <input type="number" required value={form.BHoehe} onChange={setField("BHoehe")} className="border p-2 rounded" />
        </label>

        <label className="flex flex-col gap-1">
          <span>Autor (BAutor)</span>
          <input list="autor-list" required value={form.BAutor} onChange={(e) => handleAutocomplete("BAutor", e.target.value)} className="border p-2 rounded" />
          <datalist id="autor-list">{suggestions.BAutor.map((v) => <option key={v} value={v} />)}</datalist>
        </label>

        <label className="flex flex-col gap-1">
          <span>Stichwort (BKw)</span>
          <input list="kw-list" required maxLength={25} value={form.BKw} onChange={(e) => handleAutocomplete("BKw", e.target.value)} className="border p-2 rounded" />
          <datalist id="kw-list">{suggestions.BKw.map((v) => <option key={v} value={v} />)}</datalist>
        </label>

        <label className="flex flex-col gap-1">
          <span>Position Stichwort (BKP)</span>
          <input type="number" required max={2} value={form.BKP} onChange={setField("BKP")} className="border p-2 rounded" />
        </label>

        <label className="flex flex-col gap-1">
          <span>Verlag (BVerlag)</span>
          <input list="verlag-list" required maxLength={25} value={form.BVerlag} onChange={(e) => handleAutocomplete("BVerlag", e.target.value)} className="border p-2 rounded" />
          <datalist id="verlag-list">{suggestions.BVerlag.map((v) => <option key={v} value={v} />)}</datalist>
        </label>

        <label className="flex flex-col gap-1">
          <span>Seiten (BSeiten)</span>
          <input type="number" required max={9999} value={form.BSeiten} onChange={setField("BSeiten")} className="border p-2 rounded" />
        </label>

        <label className="flex items-center gap-2 mt-1">
          <input type="checkbox" checked={form.BTop} onChange={setField("BTop")} />
          <span>Top-Titel (BTop)</span>
        </label>
      </div>

      <div className="text-sm">
        Vorschlag BMark:&nbsp;
        <strong>{suggestedMark ?? "—"}</strong>
      </div>

      <button disabled={busy} type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
        {busy ? "Speichern…" : "Speichern"}
      </button>
    </form>
  );
}
