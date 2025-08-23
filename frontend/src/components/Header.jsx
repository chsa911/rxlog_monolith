import { NavLink } from "react-router-dom";

export default function Header() {
  return (
    <header className="border-b">
      <nav className="max-w-5xl mx-auto px-4 py-3 flex gap-4">
        <NavLink to="/" className={({isActive}) => isActive ? "font-semibold" : ""}>Home</NavLink>
        <NavLink to="/register" className={({isActive}) => isActive ? "font-semibold" : ""}>Register</NavLink>
        <NavLink to="/books" className={({isActive}) => isActive ? "font-semibold" : ""}>Books</NavLink>
        <NavLink to="/search-update" className={({isActive}) => isActive ? "font-semibold" : ""}>Search & Update</NavLink> {/* ⬅️ new */}
      </nav>
    </header>
  );
}
