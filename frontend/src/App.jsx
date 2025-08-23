import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import HomePage from "./pages/HomePage";
import RegisterPage from "./pages/RegisterPage";
import BooksPage from "./pages/BooksPage";
import SearchUpdatePage from "./pages/SearchUpdatePage"; // ⬅️ add this

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-white text-gray-900">
        {/* If you have a Header component already, skip this block and edit Header.jsx below */}
        <header className="border-b">
          <nav className="max-w-5xl mx-auto px-4 py-3 flex gap-4">
            <NavLink to="/" className={({isActive}) => isActive ? "font-semibold" : ""}>Home</NavLink>
            <NavLink to="/register" className={({isActive}) => isActive ? "font-semibold" : ""}>Register</NavLink>
            <NavLink to="/books" className={({isActive}) => isActive ? "font-semibold" : ""}>Books</NavLink>
            <NavLink to="/search-update" className={({isActive}) => isActive ? "font-semibold" : ""}>Search & Update</NavLink> {/* ⬅️ new */}
          </nav>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/books" element={<BooksPage />} />
            <Route path="/search-update" element={<SearchUpdatePage />} /> {/* ⬅️ new */}
            <Route path="*" element={<div>404</div>} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
