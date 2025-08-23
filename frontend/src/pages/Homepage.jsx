import { useEffect, useMemo, useState } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import { listBooks as fetchBooks } from "../api/books";

export default function HomePage() {
  const navigate = useNavigate();

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
    const all  = await fetchBooks({ page: 1, limit: 1 });
    const open = await fetchBooks({ page: 1, limit: 1, status: "open" });
    const hist = await fetchBooks({ page: 1, limit: 1, status: "historisiert", since: sevenDaysAgoISO });
    const vorz = await fetchBooks({ page: 1, limit: 1, status: "vorzeitig", since: sevenDaysAgoISO });
    const top  = await fetchBooks({ page: 1, limit: 1, topOnly: true, since: sevenDaysAgoISO });

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
    setRecent(res.data || []); // ⬅️ changed from res.items
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
      {/* ...unchanged UI... */}
    </div>
  );
}
