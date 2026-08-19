import React from "react";

export default function VoiceButton({ listening, supported, onClick, color = "#14213D" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!supported}
      title={supported ? "Speak your message" : "Voice input not supported in this browser"}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-all
        ${listening ? "border-marigold bg-marigold/10" : "border-line bg-white hover:border-ink/40"}
        disabled:cursor-not-allowed disabled:opacity-30`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={listening ? "#E6A23C" : color} strokeWidth="2">
        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
        <path d="M19 10v2a7 7 0 01-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
      {listening && (
        <span className="absolute -mt-14 h-11 w-11 rounded-full animate-ping bg-marigold/20" />
      )}
    </button>
  );
}
