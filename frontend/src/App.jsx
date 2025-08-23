import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import HomePage from "./pages/HomePage";
import RegisterPage from "./pages/RegisterPage";
import BooksPage from "./pages/BooksPage";

function Header() {
  return (
    <header className="border-b">
      <nav className="max-w-5xl mx-auto px-4 h-12 flex items-center gap-4">
        <NavLink to="/">Home</NavLink>
        <NavLink to="/register">Register</NavLink>
        <NavLink to="/books">Books</NavLink>
      </nav>
    </header>
  );
}
function Footer() { return <footer className="border-t py-4 text-center text-sm">rxapp</footer>; }

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-white text-gray-900">
        <Header />
        <main className="max-w-5xl mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/books" element={<BooksPage />} />
            <Route path="*" element={<div>404</div>} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
