// frontend/src/components/Layout.jsx
import { useState } from "react";
import RegistrationForm from "./RegistrationForm";
import BooksTable from "./BooksTable";

export default function Layout() {
  const [view, setView] = useState("register");

  return (
    <div className="max-w-3xl mx-auto">
      <nav className="flex gap-4 p-2 bg-gray-100">
        <button onClick={()=>setView("register")}>Register</button>
        <button onClick={()=>setView("list")}>Books</button>
      </nav>

      {view === "register" ? <RegistrationForm onRegistered={()=>setView("list")}/> : <BooksTable />}
    </div>
  );
}
