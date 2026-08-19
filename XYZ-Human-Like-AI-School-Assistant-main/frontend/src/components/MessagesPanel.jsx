import React, { useEffect, useState } from "react";
import { api, ApiError } from "../api.js";
import { useLanguage } from "../context/LanguageContext.jsx";
import { t } from "../utils/i18n.js";

/**
 * Simple two-pane contact list + thread view, used on Parent, Teacher, and
 * Principal dashboards for parent<->teacher and teacher<->principal
 * communication (each relationship independently authorized server-side --
 * see permissions.can_message).
 */
export default function MessagesPanel({ title, contacts = [], token, currentUserId }) {
  const { language } = useLanguage();
  const [selected, setSelected] = useState(contacts[0]?.user_id || null);
  const [thread, setThread] = useState([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setLoading(true);
    api
      .getMessageThread(token, selected)
      .then((res) => {
        if (!cancelled) setThread(res.messages || []);
      })
      .catch(() => {
        if (!cancelled) setThread([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, token]);

  async function handleSend(e) {
    e.preventDefault();
    if (!input.trim() || !selected) return;
    setSending(true);
    setError(null);
    try {
      const msg = await api.sendDirectMessage(token, { recipient_user_id: selected, body: input.trim() });
      setThread((prev) => [...prev, msg]);
      setInput("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send message.");
    } finally {
      setSending(false);
    }
  }

  if (!contacts.length) {
    return (
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="border-b border-line px-4 py-3">
          <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
        </div>
        <p className="px-4 py-6 text-center text-sm text-muted">{t("noContactsYet", language)}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="border-b border-line px-4 py-3">
        <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
      </div>
      <div className="flex flex-col sm:flex-row">
        <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-line p-2 sm:w-44 sm:flex-col sm:border-b-0 sm:border-r">
          {contacts.map((c) => (
            <button
              key={c.user_id}
              onClick={() => setSelected(c.user_id)}
              className={`shrink-0 rounded-lg px-3 py-2 text-left text-sm ${
                selected === c.user_id ? "bg-paper-alt font-medium text-ink" : "text-muted hover:bg-paper-alt/60"
              }`}
            >
              {c.name}
              <span className="ml-1 text-[10px] uppercase text-muted/70">{c.role}</span>
            </button>
          ))}
        </div>

        <div className="flex min-h-[220px] flex-1 flex-col">
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {loading && <p className="text-xs text-muted">…</p>}
            {!loading && thread.length === 0 && (
              <p className="pt-6 text-center text-sm text-muted">{t("noMessagesYet", language)}</p>
            )}
            {thread.map((m) => (
              <div
                key={m.id}
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  m.sender_user_id === currentUserId
                    ? "ml-auto bg-ink text-white"
                    : "bg-paper-alt text-ink-text"
                }`}
              >
                {m.body}
              </div>
            ))}
          </div>
          <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-line p-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("messagePlaceholder", language)}
              className="flex-1 rounded-full border border-line px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-marigold/50"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-white disabled:opacity-40"
            >
              {t("sendMessageBtn", language)}
            </button>
          </form>
          {error && <p className="px-3 pb-2 text-xs text-danger">{error}</p>}
        </div>
      </div>
    </div>
  );
}
