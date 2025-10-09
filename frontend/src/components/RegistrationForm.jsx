import { useEffect, useState } from "react";
import { previewBySize } from "../api/bmarks";        // <- must be named export from src/api/bmarks.js
import { registerBook } from "../api/books";

export default function RegistrationForm() {
  console.log("[RegistrationForm] mounted");

  const [BBreite, setBBreite] = useState("");
  const [BHoehe,  setBHoehe]  = useState("");
  const [preview, setPreview] = useState({ firstCode: null, prefix: null, available: 0 });
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(null);

  useEffect(() => {
    const w0 = String(BBreite || "").trim();
    const h0 = String(BHoehe  || "").trim();
    console.log("[preview] effect", { w0, h0 });

    if (!w0 || !h0) {
      console.log("[preview] missing inputs → no call");
      setPreview({ firstCode: null, prefix: null, available: 0 });
      return;
    }

    const w = w0.replace(",", ".");
    const h = h0.replace(",", ".");
    let cancelled = false;

    (async () => {
      try {
        console.log("[preview] calling fetch…", { w, h });
        const info = await previewBySize(w, h); // { firstCode, prefix, available }
        if (!cancelled) {
          console.log("[preview] response", info);
          setPreview(info);
        }
      } catch (e) {
        console.warn("[preview] failed", e);
        if (!cancelled) setPreview({ firstCode: null, prefix: null, available: 0 });
      }
    })();

    return () => { cancelled = true; };
  }, [BBreite, BHoehe]);

  return (
    <div className="p-4 border rounded space-y-3">
      <h2 className="text-xl font-bold">DEBUG: RegistrationForm (Minimal)</h2>

      <div className="grid gap-2 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span>Breite (BBreite)</span>
          <input
            type="number"
            step="0.1"
            value={BBreite}
            onChange={(e) => setBBreite(e.target.value)}
            className="border p-2 rounded"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span>Höhe (BHoehe)</span>
          <input
            type="number"
            step="0.1"
            value={BHoehe}
            onChange={(e) => setBHoehe(e.target.value)}
            className="border p-2 rounded"
          />
        </label>

        <div className="flex flex-col gap-1 md:col-span-2">
          <span>Barcode (Vorschau)</span>
          <div
            className={`p-3 rounded text-lg font-semibold border text-center select-none ${
              preview.firstCode
                ? "bg-green-100 text-green-800 border-green-400"
                : "bg-red-50 text-red-600 border-red-300"
            }`}
          >
            {preview.firstCode || "— kein Barcode verfügbar —"}
          </div>
          <div className="text-xs text-gray-500">
            Serie: <strong>{preview.prefix ?? "—"}</strong> · frei:{" "}
            <strong>{preview.available ?? 0}</strong>
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          // optional: prove POST works too
          setBusy(true);
          try {
            const payload = {
              BBreite: Number(String(BBreite).replace(",", ".")),
              BHoehe:  Number(String(BHoehe).replace(",", ".")),
              BAutor: "Unbekannt",
              BKw: "Allgemein",
              BKP: 0,
              BVerlag: "Unbekannt",
              BSeiten: 0,
            };
            const res = await registerBook(payload);
            console.log("[register] response", res);
            setLast(res?.barcode || res?.BMarkb || null);
          } catch (e) {
            console.warn("[register] failed", e);
            alert(e?.message || "register failed");
          } finally {
            setBusy(false);
          }
        }}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        {busy ? "Speichern…" : "Speichern (Debug)"}
      </button>

      {last && (
        <div className="text-sm mt-2 bg-green-50 text-green-700 border border-green-300 p-2 rounded">
          Zugewiesener Barcode: <strong>{last}</strong>
        </div>
      )}
    </div>
  );
}
