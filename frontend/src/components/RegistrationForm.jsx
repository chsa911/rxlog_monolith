// frontend/src/components/RegistrationForm.jsx
import { useState, useEffect, useMemo } from "react";
import { autocomplete, registerBook } from "../api/books";
import { previewBySize, validateForSize } from "../api/bmarks"; // ← make sure this API exists
import { useAppContext } from "../context/AppContext";

function newRequestId() {
  // tiny uuid-ish request id
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
    (
      c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
    ).toString(16)
  );
}

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
    BTop: false
  });

  const [suggestedMark, setSuggestedMark] = useState(null);
  const [barcode, setBarcode] = useState(""); // ← user-chosen / override
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState({
    BAutor: [],
    BKw: [],
    BKw1: [],
    BKw2: [],
    BVerlag: []
  });

  // derive normalized width/height strings
  const normW = useMemo(
    () =>
      form.BBreite?.toString()
        .trim()
        .replace(",", ".") || "",
    [form.BBreite]
  );
  const normH = useMemo(
    () =>
      form.BHoehe?.toString()
        .trim()
        .replace(",", ".") || "",
    [form.BHoehe]
  );

  // Live preview → suggested barcode (first free in series)
  useEffect(() => {
    if (!normW || !normH) {
      setSuggestedMark(null);
      setBarcode("");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const m = await previewBySize(normW, normH);
        const first = m?.BMark || m?.firstCode || m?.items?.[0]?.BMark || null;
        if (!cancelled) {
          setSuggestedMark(first);
          // Only prefill barcode if the user hasn't typed anything
          setBarcode(b => (b ? b : first || ""));
        }
      } catch {
        if (!cancelled) {
          setSuggestedMark(null); /* keep user-entered barcode */
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [normW, normH]);

  async function handleAutocomplete(field, value) {
    setForm(f => ({ ...f, [field]: value }));

    const backendField = field === "BKw1" || field === "BKw2" ? "BKw" : field;
    if (value && value.length > 1) {
      try {
        const vals = await autocomplete(backendField, value);
        setSuggestions(s => ({ ...s, [field]: vals }));
      } catch {
        /* ignore */
      }
    }
  }

  function setField(name) {
    return e =>
      setForm(f => ({
        ...f,
        [name]: e.target.type === "checkbox" ? e.target.checked : e.target.value
      }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);

    try {
      const payload = {
        ...form,
        BBreite: Number(normW),
        BHoehe: Number(normH),
        BKP: Number(form.BKP || 0),
        BK1P: form.BK1P !== "" ? Number(form.BK1P) : null,
        BK2P: form.BK2P !== "" ? Number(form.BK2P) : null,
        BSeiten: Number(form.BSeiten || 0)
      };

      // If the user left barcode blank, fall back to suggested (backend can still auto-pick)
      const chosen = (barcode || suggestedMark || "").trim();
      if (chosen) payload.barcode = chosen;

      // Add an idempotency key to stop accidental duplicates
      payload.requestId = newRequestId();

      // Optional: client-side validation to give friendlier error before POST
      if (chosen) {
        try {
          const v = await validateForSize(
            payload.BBreite,
            payload.BHoehe,
            chosen
          );
          if (!v?.ok) throw new Error(v?.reason || "Ungültiger Barcode");
        } catch (valErr) {
          setBusy(false);
          return alert(
            typeof valErr === "string"
              ? valErr
              : valErr?.message ||
                  "Barcode passt nicht zur Größe oder ist nicht verfügbar."
          );
        }
      }

      const saved = await registerBook(payload);
      refreshBooks?.();
      onRegistered && onRegistered(saved);

      // reset
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
        BTop: false
      });
      setSuggestedMark(null);
      setBarcode("");
    } catch (err) {
      alert(
        typeof err === "string" ? err : err?.message || "Fehler beim Speichern"
      );
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

        <label className="flex flex-col gap-1 md:col-span-2">
          <span>BMark (optional – überschreibt Vorschlag)</span>
          <input
            value={barcode}
            onChange={e => setBarcode(e.target.value.trim())}
            className="border p-2 rounded"
            placeholder={
              suggestedMark ? `z.B. ${suggestedMark}` : "z.B. eik202"
            }
          />
          <small className="text-gray-600">
            Muss zur Größe passen (Serienregel) und frei sein. Leer lassen, um
            Automatik zu verwenden.
          </small>
        </label>

        <label className="flex flex-col gap-1">
          <span>Autor (BAutor)</span>
          <input
            list="autor-list"
            required
            value={form.BAutor}
            onChange={e => handleAutocomplete("BAutor", e.target.value)}
            className="border p-2 rounded"
          />
          <datalist id="autor-list">
            {suggestions.BAutor.map(v => (
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
            onChange={e => handleAutocomplete("BKw", e.target.value)}
            className="border p-2 rounded"
          />
          <datalist id="kw-list">
            {suggestions.BKw.map(v => (
              <option key={v} value={v} />
            ))}
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
            onChange={e => handleAutocomplete("BVerlag", e.target.value)}
            className="border p-2 rounded"
          />
          <datalist id="verlag-list">
            {suggestions.BVerlag.map(v => (
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

        {/* Optional 2./3. Stichwort */}
        <label className="flex flex-col gap-1">
          <span>2. Stichwort (BKw1)</span>
          <input
            list="kw1-list"
            maxLength={25}
            value={form.BKw1}
            onChange={e => handleAutocomplete("BKw1", e.target.value)}
            className="border p-2 rounded"
            placeholder="optional"
          />
          <datalist id="kw1-list">
            {suggestions.BKw1.map(v => (
              <option key={v} value={v} />
            ))}
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
            onChange={e => handleAutocomplete("BKw2", e.target.value)}
            className="border p-2 rounded"
            placeholder="optional"
          />
          <datalist id="kw2-list">
            {suggestions.BKw2.map(v => (
              <option key={v} value={v} />
            ))}
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
          <input
            type="checkbox"
            checked={form.BTop}
            onChange={setField("BTop")}
          />
          <span>Top-Titel (BTop)</span>
        </label>
      </div>

      <div className="text-sm">
        Vorschlag BMark: <strong>{suggestedMark ?? "—"}</strong>
      </div>

      <button
        disabled={busy}
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        {busy ? "Speichern…" : "Speichern"}
      </button>
    </form>
  );
}
