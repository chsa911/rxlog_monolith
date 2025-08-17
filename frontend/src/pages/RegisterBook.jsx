import { useState, useEffect } from "react";
import axios from "axios";

export default function BookRegistrationForm() {
  const [form, setForm] = useState({
    BBreite: "",
    BHoehe: "",
    BAutor: "",
    BKw: "",
    BKP: "",
    BKw1: "",
    BK1P: "",
    BKw2: "",
    BK2P: "",
    BVerlag: "",
    BSeiten: "",
    BMarkb: "",
    BErg: "",
    BTop: false
  });

  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState({});
  const [feedback, setFeedback] = useState("");

  // Fetch a BMark from backend on load
  useEffect(() => {
    async function fetchBMark() {
      try {
        const res = await axios.get("/api/books/nextBMark");
        setForm(prev => ({ ...prev, BMarkb: res.data }));
      } catch (err) {
        console.error(err);
      }
    }
    fetchBMark();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    // Autocomplete logic
    if (["BAutor", "BKw", "BKw1", "BKw2", "BVerlag"].includes(name) && value.length > 0) {
      axios.get(`/api/books/autocomplete?field=${name}&query=${value}`)
        .then(res => setAutocompleteSuggestions(prev => ({ ...prev, [name]: res.data })))
        .catch(() => setAutocompleteSuggestions(prev => ({ ...prev, [name]: [] })));
    }
  };

  const handleSelectSuggestion = (field, suggestion) => {
    setForm(prev => ({ ...prev, [field]: suggestion }));
    setAutocompleteSuggestions(prev => ({ ...prev, [field]: [] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post("/api/books/register", form);
      if (res.data.success) {
        setFeedback("Book registered successfully!");
        // Clear form except BMark (if you want new assignment)
        setForm(prev => ({
          ...prev,
          BBreite: "", BHoehe: "", BAutor: "", BKw: "", BKP: "",
          BKw1: "", BK1P: "", BKw2: "", BK2P: "", BVerlag: "", BSeiten: "",
          BErg: "", BTop: false
        }));
        // Fetch new BMark
        const newBMark = await axios.get("/api/books/nextBMark");
        setForm(prev => ({ ...prev, BMarkb: newBMark.data }));
      } else {
        setFeedback("Registration failed. Try again.");
      }
    } catch (err) {
      console.error(err);
      setFeedback("An error occurred. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {feedback && <p>{feedback}</p>}

      <input name="BBreite" type="number" placeholder="Breite" required value={form.BBreite} onChange={handleChange} />
      <input name="BHoehe" type="number" placeholder="Höhe" required value={form.BHoehe} onChange={handleChange} />

      <AutocompleteField name="BAutor" placeholder="Autor" value={form.BAutor} suggestions={autocompleteSuggestions.BAutor || []} onChange={handleChange} onSelect={handleSelectSuggestion} />
      <AutocompleteField name="BKw" placeholder="Stichwort" value={form.BKw} suggestions={autocompleteSuggestions.BKw || []} onChange={handleChange} onSelect={handleSelectSuggestion} />
      <input name="BKP" type="number" max="2" placeholder="Position Stichwort" value={form.BKP} onChange={handleChange} />

      <AutocompleteField name="BKw1" placeholder="Stichwort 1" value={form.BKw1} suggestions={autocompleteSuggestions.BKw1 || []} onChange={handleChange} onSelect={handleSelectSuggestion} />
      <input name="BK1P" type="number" max="2" placeholder="Position Stichwort 1" value={form.BK1P} onChange={handleChange} />

      <AutocompleteField name="BKw2" placeholder="Stichwort 2" value={form.BKw2} suggestions={autocompleteSuggestions.BKw2 || []} onChange={handleChange} onSelect={handleSelectSuggestion} />
      <input name="BK2P" type="number" max="2" placeholder="Position Stichwort 2" value={form.BK2P} onChange={handleChange} />

      <AutocompleteField name="BVerlag" placeholder="Verlag" value={form.BVerlag} suggestions={autocompleteSuggestions.BVerlag || []} onChange={handleChange} onSelect={handleSelectSuggestion} />

      <input name="BSeiten" type="number" max="9999" placeholder="Seiten" required value={form.BSeiten} onChange={handleChange} />

      <input name="BMarkb" type="text" placeholder="Assigned BMark" value={form.BMarkb} readOnly />

      <label>
        <input type="radio" name="BErg" value="completed" checked={form.BErg === "completed"} onChange={handleChange} /> Completed
      </label>
      <label>
        <input type="radio" name="BErg" value="not_completed" checked={form.BErg === "not_completed"} onChange={handleChange} /> Not Completed
      </label>

      <label>
        <input type="checkbox" name="BTop" checked={form.BTop} onChange={handleChange} /> Top Titel
      </label>

      <button type="submit">Register Book</button>
    </form>
  );
}

// Autocomplete Field Component
function AutocompleteField({ name, value, placeholder, suggestions, onChange, onSelect }) {
  return (
    <div style={{ position: "relative" }}>
      <input name={name} value={value} placeholder={placeholder} onChange={onChange} />
      {suggestions.length > 0 && (
        <ul style={{ position: "absolute", top: "100%", left: 0, right: 0, maxHeight: "150px", overflowY: "auto", border: "1px solid #ccc", backgroundColor: "white", padding: 0, margin: 0 }}>
          {suggestions.map((s, idx) => (
            <li key={idx} onClick={() => onSelect(name, s)} style={{ padding: "5px", cursor: "pointer" }}>{s}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
