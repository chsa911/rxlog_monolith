import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import HomePage from "@/pages/HomePage";
import RegisterPage from "@/pages/RegisterPage";
import BooksPage from "@/pages/BooksPage";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

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
