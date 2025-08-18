import { createContext, useContext, useState, useEffect } from "react";
import { fetchBooks } from "@/api/books";

const AppContext = createContext();

export function AppProvider({ children }) {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);

  // Load initial books (first page only for global preview)
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetchBooks({ page: 1, limit: 5, sortBy: "BEind", order: "desc" });
        setBooks(res.items);
      } catch (err) {
        console.error("Failed to load books:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [needsReload]);

  // Trigger a reload (e.g. after new book registration)
  const refreshBooks = () => setNeedsReload(r => !r);

  return (
    <AppContext.Provider
      value={{
        books,
        loading,
        refreshBooks,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
