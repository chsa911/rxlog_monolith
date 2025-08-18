import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import RegisterPage from "@/pages/RegisterPage";
import BooksPage from "@/pages/BooksPage";
import HomePage from "@/pages/HomePage";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-white text-gray-900">
        <Header />
        <main className="max-w-5xl mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<Navigate to="/register" replace />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/books" element={<BooksPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
