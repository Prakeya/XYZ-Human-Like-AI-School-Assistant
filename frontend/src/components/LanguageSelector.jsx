import React, { useEffect, useRef, useState } from "react";
import { SUPPORTED_LANGUAGES, t } from "../utils/i18n.js";
import { useLanguage } from "../context/LanguageContext.jsx";

// Custom-rendered dropdown instead of a native <select>. Native <select>
// popups are painted by the OS/browser shell rather than the page itself,
// and on some Linux window-manager setups that popup layer can fail to
// appear at all -- the trigger looks fine and the arrow is clickable, but
// nothing ever opens. Rendering our own list keeps everything inside the
// page's own DOM, so it always opens regardless of platform.
export default function LanguageSelector({ compact = false, openUp = false }) {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const current = SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function handleEscape(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("chooseLanguageAriaLabel", language)}
        className={`flex w-full items-center justify-between gap-2 rounded-full border border-line bg-white/80 text-ink-text text-sm font-body
          focus:outline-none focus:ring-2 focus:ring-marigold/60 ${compact ? "px-3 py-1" : "px-4 py-2"}`}
      >
        <span className="truncate">{current.label}</span>
        <span className={`text-[10px] transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <ul
          role="listbox"
          className={`absolute left-0 z-30 max-h-64 w-full min-w-[9rem] overflow-y-auto rounded-xl border border-line bg-white py-1 text-sm shadow-lg ${
            openUp ? "bottom-full mb-1.5" : "top-full mt-1.5"
          }`}
        >
          {SUPPORTED_LANGUAGES.map((l) => (
            <li key={l.code}>
              <button
                type="button"
                role="option"
                aria-selected={l.code === language}
                onClick={() => {
                  setLanguage(l.code);
                  setOpen(false);
                }}
                className={`block w-full px-3.5 py-2 text-left hover:bg-paper-alt ${
                  l.code === language ? "font-semibold text-ink" : "text-ink-text"
                }`}
              >
                {l.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
