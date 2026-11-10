/* eslint-disable react/prop-types */
import { useRef, useState } from "react";

export default function MediaFilePicker({ id, label, ariaLabel, accept, multiple = false, onFiles, hint, compact = false, disabled = false }) {
  const input = useRef(null);
  const [dragging, setDragging] = useState(false);
  return <div className={`${compact ? "hl-file-picker-compact" : "hl-file-picker"}${dragging ? " is-dragging" : ""}`}
    onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
    onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
    onDrop={(event) => {
      event.preventDefault(); setDragging(false);
      if (!disabled) onFiles(Array.from(event.dataTransfer.files));
    }}>
    <button type="button" className="hl-button hl-secondary" disabled={disabled}
      aria-label={ariaLabel} aria-describedby={hint ? `${id}-hint` : undefined} onClick={() => input.current?.click()}>{label}</button>
    {!compact && <span className="hl-form-hint">or drag and drop here</span>}
    <input ref={input} id={id} type="file" accept={accept} multiple={multiple} disabled={disabled} hidden
      aria-label={label} onChange={(event) => {
        const files = Array.from(event.target.files || []); event.target.value = "";
        if (files.length) onFiles(files);
      }} />
    {hint && <p id={`${id}-hint`} className="hl-form-hint">{hint}</p>}
  </div>;
}
