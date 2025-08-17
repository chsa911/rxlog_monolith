import { useState, useEffect } from "react";
import axios from "axios";

export default function AutocompleteInput({ field, placeholder, required = false }) {
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleChange = async (e) => {
    const input = e.target.value;
    setValue(input);

    if (input.length >= 1) { // Start autocomplete after 1 character
      try {
        const res = await axios.get(`/api/books/autocomplete?field=${field}&query=${input}`);
        setSuggestions(res.data); // Array of strings
        setShowDropdown(true);
      } catch (error) {
        console.error("Autocomplete error:", error);
        setSuggestions([]);
      }
    } else {
      setShowDropdown(false);
      setSuggestions([]);
    }
  };

  const handleSelect = (suggestion) => {
    setValue(suggestion);
    setShowDropdown(false);
  };

  return (
    <div style={{ position: "relative" }}>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        required={required}
      />
      {showDropdown && suggestions.length > 0 && (
        <ul style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          border: "1px solid #ccc",
          backgroundColor: "white",
          maxHeight: "150px",
          overflowY: "auto",
          zIndex: 1000,
          listStyle: "none",
          padding: 0,
          margin: 0
        }}>
          {suggestions.map((s, idx) => (
            <li
              key={idx}
              onClick={() => handleSelect(s)}
              style={{ padding: "5px", cursor: "pointer" }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
