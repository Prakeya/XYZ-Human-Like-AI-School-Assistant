import React from "react";
import { SUPPORTED_LANGUAGES } from "../utils/i18n.js";
import { useLanguage } from "../context/LanguageContext.jsx";

// All 11 languages are fully localized (UI strings + backend response
// templates), so the selector no longer needs a "(partial)" qualifier.
export default function LanguageSelector({ compact = false }) {
  const { language, setLanguage } = useLanguage();

  return (
    <select
      value={language}
      onChange={(e) => setLanguage(e.target.value)}
      className={`rounded-full border border-line bg-white/80 text-ink-text text-sm font-body
        focus:outline-none focus:ring-2 focus:ring-marigold/60 ${compact ? "px-3 py-1" : "px-4 py-2"}`}
      aria-label="Choose language"
    >
      {SUPPORTED_LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
