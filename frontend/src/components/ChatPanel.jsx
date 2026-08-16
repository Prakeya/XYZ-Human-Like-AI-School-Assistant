import React, { useEffect, useRef, useState, useCallback } from "react";
import { api, ApiError } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useSpeech } from "../hooks/useSpeech.js";
import { personaFor } from "../utils/personas.js";
import { t } from "../utils/i18n.js";
import Avatar from "./Avatar.jsx";
import MessageBubble from "./MessageBubble.jsx";
import VoiceButton from "./VoiceButton.jsx";
import LanguageSelector from "./LanguageSelector.jsx";

const CONVO_KEY_PREFIX = "xyzai_conversation_id_";

// Suggestion chips map to the exact example phrasing from the spec (section 1),
// per role, plus the two escalation entry points from section 9. These just
// prefill/send a message through the normal chat pipeline -- no shortcut
// around intent detection or permissions.
const SUGGESTIONS = {
  student: ["What is my attendance?"],
  parent: ["How much attendance does my child have?"],
  teacher: ["Mark Rahul absent today."],
  principal: ["What is the overall attendance?"],
};

export default function ChatPanel() {
  const { user, token } = useAuth();
  const { language } = useLanguage();
  const persona = personaFor(user?.role);
  const speech = useSpeech(language);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [conversationId, setConversationId] = useState(() =>
    Number(localStorage.getItem(CONVO_KEY_PREFIX + user?.id)) || null
  );
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  // Reload prior turns for this user's conversation on mount (Phase 3 already
  // persists conversation memory server-side -- this just replays it into the UI).
  useEffect(() => {
    async function loadHistory() {
      if (!conversationId || !token) return;
      try {
        const res = await api.getHistory(token, conversationId);
        const restored = (res.messages || []).map((m, i) => ({
          id: `h${i}`,
          sender: m.sender,
          content: m.content,
        }));
        if (restored.length) setMessages(restored);
      } catch {
        // If history can't be loaded (e.g. stale conversation id), just start fresh.
        setConversationId(null);
      }
    }
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const avatarState = speech.listening
    ? "listening"
    : sending
    ? "thinking"
    : speech.speaking
    ? "speaking"
    : "idle";

  const pushMessage = (msg) => setMessages((prev) => [...prev, { id: crypto.randomUUID(), ...msg }]);

  const send = useCallback(
    async (text) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;
      setError(null);
      pushMessage({ sender: "user", content: trimmed });
      setInput("");
      setSending(true);
      try {
        const res = await api.sendMessage(token, {
          message: trimmed,
          language,
          conversationId,
        });
        if (res.conversation_id !== conversationId) {
          setConversationId(res.conversation_id);
          localStorage.setItem(CONVO_KEY_PREFIX + user.id, String(res.conversation_id));
        }
        pushMessage({
          sender: "assistant",
          content: res.reply,
          trace: res.trace,
          pendingAction: res.pending_action || null,
        });
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
        setError(msg);
        pushMessage({ sender: "error", content: msg });
      } finally {
        setSending(false);
      }
    },
    [sending, token, language, conversationId, user]
  );

  const handleConfirm = (yes) => {
    send(yes ? "yes" : "no");
  };

  const handleMicClick = () => {
    if (speech.listening) {
      speech.stopListening();
      return;
    }
    speech.cancelSpeaking();
    speech.startListening((finalText) => send(finalText));
  };

  const latestAssistantId = [...messages].reverse().find((m) => m.sender === "assistant")?.id;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-line bg-paper-alt/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line bg-white px-5 py-3.5">
        <div className="flex items-center gap-3">
          <Avatar state={avatarState} color={persona.color} size={44} />
          <div>
            <p className="font-display text-[15px] font-semibold leading-tight text-ink">
              {t("assistant", language)}
            </p>
            <p className="text-xs text-muted">{persona.title} · {persona.tagline}</p>
          </div>
        </div>
        <LanguageSelector compact />
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <Avatar state="idle" color={persona.color} size={72} />
            <div>
              <p className="font-display text-lg text-ink">
                {persona.tagline}, at your service.
              </p>
              <p className="mt-1 text-sm text-muted">Ask about attendance, or try a suggestion below.</p>
            </div>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            language={language}
            personaColor={persona.color}
            isLatestAssistant={m.id === latestAssistantId}
            onConfirm={handleConfirm}
            onSpeak={speech.speak}
            ttsSupported={speech.ttsSupported}
          />
        ))}

        {sending && (
          <div className="flex items-center gap-2 text-xs text-muted" role="status" aria-live="polite">
            <Avatar state="idle" color={persona.color} size={24} />
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-line [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-line [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-line" />
            </span>
            <span>XYZ AI is checking with the backend…</span>
          </div>
        )}

        {speech.listening && speech.interimTranscript && (
          <p className="text-right text-xs italic text-muted">{speech.interimTranscript}…</p>
        )}
      </div>

      {/* Suggestions */}
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2 border-t border-line bg-white px-5 py-3">
          {(SUGGESTIONS[user?.role] || []).map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-line px-3 py-1.5 text-xs text-ink-text hover:border-marigold hover:text-marigold-deep transition-colors"
            >
              {s}
            </button>
          ))}
          <button
            onClick={() => send("I need to talk to a teacher.")}
            className="rounded-full border border-line px-3 py-1.5 text-xs text-ink-text hover:border-marigold hover:text-marigold-deep transition-colors"
          >
            {t("talkToTeacher", language)}
          </button>
          <button
            onClick={() => send("I want to contact school management.")}
            className="rounded-full border border-line px-3 py-1.5 text-xs text-ink-text hover:border-marigold hover:text-marigold-deep transition-colors"
          >
            {t("contactManagement", language)}
          </button>
        </div>
      )}

      {!speech.supported && (
        <p className="px-5 pt-2 text-[11px] text-muted">{t("speakNotSupported", language)}</p>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-line bg-white px-4 py-3"
      >
        <VoiceButton
          listening={speech.listening}
          supported={speech.supported}
          onClick={handleMicClick}
          color={persona.color}
        />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={speech.listening ? t("listening", language) : t("typeMessage", language)}
          className="flex-1 rounded-full border border-line bg-paper px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-marigold/50"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="rounded-full px-5 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-40"
          style={{ background: persona.color }}
        >
          {t("send", language)}
        </button>
      </form>
    </div>
  );
}
