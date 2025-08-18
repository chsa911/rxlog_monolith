import { useEffect, useMemo, useState } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import { fetchBooks } from "@/api/books";

export default function HomePage() {
  const navigate = useNavigate();

  // --- time windows
  const todayISO = new Date().toISOString().slice(0, 10);
  const sevenDaysAgoISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  }, []);

  const [stats, setStats] = useState({
    open: 0,
    historisiertRecent: 0,
    vorzeitigRecent: 0,
    topRecent: 0,
    total: 0,
  });
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadStats() {
    // total (all)
    const all = await fetchBooks({ page: 1, limit: 1 });
    // open
    const open = await fetchBooks({ page: 1, limit: 1, status: "open" });
    // historisiert in last 7 days
    const hist = await fetchBooks({ page: 1, limit: 1, status: "historisiert", since: sevenDaysAgoISO });
    // vorzeitig in last 7 days
    const vorz = await fetchBooks({ page: 1, limit: 1, status: "vorzeitig", since: sevenDaysAgoISO });
    // top only in last 7 days
    const top = await fetchBooks({ page: 1, limit: 1, topOnly: true, since: sevenDaysAgoISO });

    setStats({
      total: all.total || 0,
      open: open.total || 0,
      historisiertRecent: hist.total || 0,
      vorzeitigRecent: vorz.total || 0,
      topRecent: top.total || 0,
    });
  }

  async function loadRecent() {
    const res = await fetchBooks({ page: 1, limit: 5, sortBy: "BEind", sortDir: "desc" });
    setRecent(res.items || []);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await Promise.all([loadStats(), loadRecent()]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Übersicht</h1>
        <div className="flex gap-2">
          <button
            onClick={() => navigate("/register")}
            className="px-3 py-2 rounded bg-blue-600 text-white"
          >
            + Buch registrieren
          </button>
          <button
            onClick={() => navigate("/books")}
            className="px-3 py-2 rounded border"
          >
            Alle Bücher
          </button>
        </div>
      </header>

      {/* Stats cards */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Gesamt" value={stats.total} sub={`Stand ${todayISO}`} />
        <StatCard
          label="Open"
          value={stats.open}
          sub="nicht historisiert / vorzeitig"
          onClick={() => navigate("/books?status=open")}
        />
        <StatCard
          label="Historisiert (7 T.)"
          value={stats.historisiertRecent}
          sub={`seit ${sevenDaysAgoISO}`}
          onClick={() => navigate("/books?status=historisiert")}
        />
        <StatCard
          label="Vorzeitig (7 T.)"
          value={stats.vorzeitigRecent}
          sub={`seit ${sevenDaysAgoISO}`}
          onClick={() => navigate("/books?status=vorzeitig")}
        />
        <StatCard
          label="Top (7 T.)"
          value={stats.topRecent}
          sub={`seit ${sevenDaysAgoISO}`}
          className="sm:col-span-2 lg:col-span-1"
          onClick={() => navigate("/books?topOnly=true")}
        />
      </section>

      {/* Recent list */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Zuletzt registriert</h2>
          <NavLink className="text-blue-600 hover:underline" to="/books">
            Mehr ansehen
          </NavLink>
        </div>

        <div className="border rounded overflow-hidden">
          <div className="grid grid-cols-12 bg-gray-50 text-sm font-medium">
            <Cell head span={4}>Autor</Cell>
            <Cell head span={3}>Stichwort</Cell>
            <Cell head span={2}>BMark</Cell>
            <Cell head span={1}>Seiten</Cell>
            <Cell head span={2}>Erfasst</Cell>
          </div>

          {loading ? (
            <div className="p-4 text-sm">Laden…</div>
          ) : recent.length === 0 ? (
            <div className="p-4 text-sm">Keine Einträge</div>
          ) : (
            recent.map((b) => (
              <div key={b._id} className="grid grid-cols-12 border-t text-sm">
                <Cell span={4}>{b.BAutor}</Cell>
                <Cell span={3}>{b.BKw}</Cell>
                <Cell span={2}>{b.BMarkb ?? "—"}</Cell>
                <Cell span={1}>{b.BSeiten}</Cell>
                <Cell span={2}>{b.BEind ? new Date(b.BEind).toLocaleDateString() : "—"}</Cell>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, sub, onClick, className = "" }) {
  return (
    <button
      onClick={onClick}
      className={`text-left border rounded p-4 hover:bg-gray-50 transition ${className}`}
    >
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-3xl font-bold">{value}</div>
      {sub ? <div className="text-xs text-gray-500 mt-1">{sub}</div> : null}
    </button>
  );
}

function Cell({ head = false, span = 3, children }) {
  const base = head ? "p-2 border-b" : "p-2";
  return <div className={`${base} col-span-${span}`}>{children}</div>;
}
