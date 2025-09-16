// frontend/src/components/RadioCheckbox.jsx
import React from "react";

/**
 * Simple radio/checkbox wrapper.
 * @param {object} props
 * @param {string} props.name
 * @param {string} props.value
 * @param {boolean} [props.checked]
 * @param {(e: React.ChangeEvent<HTMLInputElement>) => void} [props.onChange]
 * @param {string} [props.label]
 * @param {"radio"|"checkbox"} [props.type="radio"]
 */
export default function RadioCheckbox({
  name,
  value,
  checked = false,
  onChange,
  label,
  type = "radio",
}) {
  const id = `${name}-${value}`;
  return (
    <label htmlFor={id} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <input
        id={id}
        type={type}
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
      />
      <span>{label ?? value}</span>
    </label>
  );
}
