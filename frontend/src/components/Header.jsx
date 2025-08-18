import { NavLink } from "react-router-dom";

export default function Header() {
  return (
    <nav style={{ padding: 12, borderBottom: "1px solid #eee" }}>
      <NavLink to="/register" style={{ marginRight: 12 }}>
        Register
      </NavLink>
      <NavLink to="/books">Books</NavLink>
    </nav>
  );
}
