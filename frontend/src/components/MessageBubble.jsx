import React from "react";
import TraceRibbon from "./TraceRibbon.jsx";
import { t } from "../utils/i18n.js";

export default function MessageBubble({
  message,
  language,
  personaColor,
  isLatestAssistant,
  onConfirm,
  onSpeak,
  ttsSupported,
}) {
  const isUser = message.sender === "user";
  const isError = message.sender === "error";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[78%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm text-white shadow-sm"
          style={{ background: personaColor }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div
        className={`max-w-[82%] rounded-2xl rounded-bl-sm border px-4 py-3 text-sm shadow-sm ${
          isError ? "border-danger/40 bg-danger/5 text-danger" : "border-line bg-white text-ink-text"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
          {!isError && ttsSupported && (
            <button
              onClick={() => onSpeak(message.content)}
              className="mt-0.5 shrink-0 text-muted hover:text-ink transition-colors"
              title={t("playResponseTitle", language)}
              aria-label={t("playResponseTitle", language)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.5 8.5a5 5 0 010 7" />
              </svg>
            </button>
          )}
        </div>

        {message.trace && <TraceRibbon trace={message.trace} language={language} />}

        {isLatestAssistant && message.pendingAction && (
          <div className="mt-3 border-t border-line pt-3">
            <p className="mb-2 text-xs text-muted">{t("awaitingConfirmation", language)}</p>
            <div className="flex gap-2">
              <button
                onClick={() => onConfirm(true)}
                className="rounded-full bg-ink px-3.5 py-1.5 text-xs font-medium text-white hover:bg-ink-light transition-colors"
              >
                {t("confirmYes", language)}
              </button>
              <button
                onClick={() => onConfirm(false)}
                className="rounded-full border border-line px-3.5 py-1.5 text-xs font-medium text-ink-text hover:bg-paper-alt transition-colors"
              >
                {t("confirmNo", language)}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
