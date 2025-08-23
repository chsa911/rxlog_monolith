// frontend/src/components/RegistrationForm.jsx
import { useState, useEffect } from "react";
import { prefixBySize, previewBySize, registerBook } from "../api/bmarks";
import { autocomplete } from "../api/books";
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

  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState({
    BAutor: [],
    BKw: [],
    BVerlag: [],
  });

  const [computedPrefix, setComputedPrefix] = useState(null);
  const [suggestedMark, setSuggestedMark] = useState(null);
  const [previewError, setPreviewError] = useState("");

  // helper: normalize 12,5 → "12.5" for calls, but keep raw in inputs
  const norm = (v) => (v == null ? "" : String(v).trim().replace(",", "."));

  // Live compute prefix + preview available mark
  useEffect(() => {
    setPreviewError("");
    setSuggestedMark(null);
    setComputedPrefix(null);

    const wRaw = form.BBreite?.toString().trim();
    const hRaw = form.BHoehe?.toString().trim();
    if (!wRaw || !hRaw) return;

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        // 1) compute prefix from backend rules
        const { prefix } = await prefixBySize(norm(wRaw), norm(hRaw));
        setComputedPrefix(prefix ?? null);

        // 2) preview first available mark in pool for that size
        if (prefix) {
          const m = await previewBySize(norm(wRaw), norm(hRaw));
          setSuggestedMark(m?.BMark || null);
        } else {
          setSuggestedMark(null);
        }
      } catch (e) {
        console.error("[RegistrationForm] preview failed:", e);
        setPreviewError(e.message || "Preview fehlgeschlagen");
      }
    }, 250); // debounce

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [form.BBreite, form.BHoehe]);

  // Autocomplete fetch
  async function handleAutocomplete(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (value && value.length > 1) {
      try {
        const vals = await autocomplete(field, value);
        setSuggestions((s) => ({ ...s, [field]: vals }));
      } catch {
        // ignore errors
      }
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
      // Prepare payload, numbers normalized
      const payload = {
        ...form,
        BBreite: Number(norm(form.BBreite)),
        BHoehe: Number(norm(form.BHoehe)),
        BKP: Number(form.BKP || 0),
        BK1P: form.BK1P ? Number(form.BK1P) : null,
        BK2P: form.BK2P ? Number(form.BK2P) : null,
        BSeiten: Number(form.BSeiten),
      BHVorV: "", // '', 'H', or 'V'

      };

      const saved = await registerBook(payload);

      refreshBooks?.();
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
      setComputedPrefix(null);
      setSuggestedMark(null);
      setPreviewError("");
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
          {/* use type="text" so users can type comma; we normalize in code */}
          <input
            type="text"
            inputMode="decimal"
            placeholder="z.B. 11,2"
            required
            value={form.BBreite}
            onChange={setField("BBreite")}
            className="border p-2 rounded"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span>Höhe (BHoehe)</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="z.B. 17,8"
            required
            value={form.BHoehe}
            onChange={setField("BHoehe")}
            className="border p-2 rounded"
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
            {suggestions.BAutor.map((v) => (
              <option key={v} value={v} />
            ))}
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
            {suggestions.BKw.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </label>

        <label className="flex flex-col gap-1">
          <span>Position Stichwort (BKP)</span>
          <input
            type="number"
            required
            max={2}
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
            {suggestions.BVerlag.map((v) => (
              <option key={v} value={v} />
            ))}
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
<div className="flex flex-col gap-1">
  <span className="font-medium">Ausrichtung</span>
  <div className="flex items-center gap-6">
    <label className="inline-flex items-center gap-2">
      <input
        type="radio"
        name="BHVorV"
        value="H"
        checked={form.BHVorV === "H"}
        onChange={setField("BHVorV")}
      />
      <span>H</span>
    </label>
    <label className="inline-flex items-center gap-2">
      <input
        type="radio"
        name="BHVorV"
        value="V"
        checked={form.BHVorV === "V"}
        onChange={setField("BHVorV")}
      />
      <span>V</span>
    </label>
  </div>
</div>

        <label className="flex items-center gap-2 mt-1">
          <input type="checkbox" checked={form.BTop} onChange={setField("BTop")} />
          <span>Top-Titel (BTop)</span>
        </label>
      </div>

      <div className="p-3 border rounded bg-gray-50 text-sm space-y-1">
        <div>Ermitteltes Prefix: <b>{computedPrefix ?? "—"}</b></div>
        <div>
          Nächster freier BMark: <b>{suggestedMark ?? (computedPrefix ? "— (kein frei)" : "—")}</b>
        </div>
        {previewError && <div className="text-red-600">{previewError}</div>}
      </div>

      <button disabled={busy} type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
        {busy ? "Speichern…" : "Speichern"}
      </button>
    </form>
  );
}
