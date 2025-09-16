import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import RegistrationForm from "./pages/RegisterPage"; // your component as given
import SearchUpdatePage from "./pages/SearchUpdatePage";  // the page we built

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        {/* Top bar */}
        <header className="border-b bg-white/70 backdrop-blur sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="font-semibold">rxlog</div>
            <nav className="flex items-center gap-4 text-sm">
              <NavLink
                to="/register"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded ${isActive ? "bg-blue-600 text-white" : "hover:bg-gray-100"}`
                }
              >
                Registrieren
              </NavLink>
              <NavLink
                to="/update"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded ${isActive ? "bg-blue-600 text-white" : "hover:bg-gray-100"}`
                }
              >
                Suche / Update
              </NavLink>
            </nav>
          </div>
        </header>

        {/* Content */}
        <main className="max-w-6xl mx-auto w-full p-4 flex-1">
          <Routes>
            <Route path="/" element={<Navigate to="/register" replace />} />
            <Route path="/register" element={<RegistrationForm />} />
            <Route path="/update" element={<SearchUpdatePage />} />
            <Route path="*" element={<div className="p-6">Seite nicht gefunden</div>} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
