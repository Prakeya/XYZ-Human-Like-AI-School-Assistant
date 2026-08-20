import React, { useState } from "react";
import { api, ApiError } from "../api.js";
import { useLanguage } from "../context/LanguageContext.jsx";
import { t, tableHeaderClass } from "../utils/i18n.js";

function requestTypeLabel(reqType, language) {
  if (reqType === "teacher_call") return t("talkToTeacher", language);
  if (reqType === "management_support") return t("contactManagement", language);
  return reqType;
}

/**
 * Inline "message the requester" box -- lets a teacher reply directly to the
 * parent (or principal reply to a teacher) who raised a request, without
 * leaving the escalations table. Uses the same authorized messaging endpoint
 * as the full Messages panel (see permissions.can_message).
 */
function QuickMessageBox({ req, token, language, onClose }) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  async function handleSend() {
    if (!body.trim() || !req.requester_user_id) return;
    setSending(true);
    setError(null);
    try {
      await api.sendDirectMessage(token, {
        recipient_user_id: req.requester_user_id,
        body: body.trim(),
        related_student_id: null,
      });
      setSent(true);
      setBody("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("couldntSendMessage", language));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t("messagePlaceholder", language)}
        className="w-48 rounded-full border border-line px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-marigold/50"
      />
      <button
        onClick={handleSend}
        disabled={sending || !body.trim()}
        className="rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
      >
        {t("sendMessageBtn", language)}
      </button>
      <button onClick={onClose} className="text-xs text-muted hover:underline">
        {t("closeBtn", language)}
      </button>
      {sent && <span className="text-xs text-success">✓</span>}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

/**
 * Renders one escalation/complaint row. Kept separate so the Resolve button's
 * own in-flight/error state doesn't re-render the whole table.
 */
function EscalationRow({ req, token, onResolved, resolvable, canForward, canMessage, language }) {
  const [resolving, setResolving] = useState(false);
  const [forwarding, setForwarding] = useState(false);
  const [error, setError] = useState(null);
  const [showMessageBox, setShowMessageBox] = useState(false);

  async function handleResolve() {
    setResolving(true);
    setError(null);
    try {
      await api.resolveEscalation(token, req.id);
      onResolved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("resolveErrorGeneric", language));
    } finally {
      setResolving(false);
    }
  }

  async function handleForward() {
    setForwarding(true);
    setError(null);
    try {
      await api.forwardEscalation(token, req.id);
      onResolved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("resolveErrorGeneric", language));
    } finally {
      setForwarding(false);
    }
  }

  const alreadyForwarded = !!req.forwarded_to_principal;
  const showResolveActions = req.status !== "resolved" && resolvable && !alreadyForwarded;

  return (
    <tr>
      <td className="px-4 py-3 font-medium text-ink-text">
        {req.requester_name}
        {req.student_name && <span className="block text-xs text-muted">{t("reLabel", language)} {req.student_name}</span>}
      </td>
      <td className="px-4 py-3 text-muted">{requestTypeLabel(req.request_type, language)}</td>
      <td className="px-4 py-3 text-muted">{req.message || "—"}</td>
      <td className="px-4 py-3 text-muted">
        {req.created_at ? new Date(req.created_at).toLocaleDateString() : "—"}
      </td>
      <td className="px-4 py-3">
        {req.status === "resolved" ? (
          <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
            {t("resolvedBadge", language)}
          </span>
        ) : alreadyForwarded ? (
          <span className="rounded-full bg-role-principal/10 px-2.5 py-1 text-xs font-medium text-role-principal">
            {t("forwardedBadge", language)}
          </span>
        ) : (
          <span className="rounded-full bg-paper-alt px-2.5 py-1 text-xs font-medium text-muted">
            {t("pendingBadge", language)}
          </span>
        )}

        {showResolveActions && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              onClick={handleResolve}
              disabled={resolving}
              className="rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {resolving ? t("resolvingBtn", language) : t("resolveBtn", language)}
            </button>
            {canForward && (
              <button
                onClick={handleForward}
                disabled={forwarding}
                className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-text hover:bg-paper-alt disabled:opacity-50"
              >
                {forwarding ? t("forwardingBtn", language) : t("forwardToPrincipalBtn", language)}
              </button>
            )}
          </div>
        )}

        {canMessage && req.requester_user_id && (
          <div className="mt-2">
            {showMessageBox ? (
              <QuickMessageBox req={req} token={token} language={language} onClose={() => setShowMessageBox(false)} />
            ) : (
              <button
                onClick={() => setShowMessageBox(true)}
                className="text-xs font-medium text-marigold-deep hover:underline"
              >
                {t("messageParentBtn", language)}
              </button>
            )}
          </div>
        )}

        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </td>
    </tr>
  );
}

/**
 * @param escalations {{pending: array, resolved: array}} -- from /dashboard's
 *   "escalations" field (see tools.list_escalations on the backend).
 * @param resolvable  whether THIS viewer is allowed to click Resolve (the
 *   backend re-checks this on every click regardless -- see
 *   permissions.can_resolve_escalation -- this only controls whether the
 *   button renders, not the actual authorization).
 * @param canForward   whether THIS viewer (a teacher) can forward a pending
 *   request they find hard to resolve up to the Principal.
 * @param canMessage   whether THIS viewer can message the person who raised
 *   the request directly (teacher/principal replying to a parent/teacher).
 */
export default function EscalationsTable({
  escalations, token, onRefresh, resolvable = true, canForward = false, canMessage = false, showTabs = false,
}) {
  const { language } = useLanguage();
  const [tab, setTab] = useState("pending");
  const pending = escalations?.pending || [];
  const resolved = escalations?.resolved || [];
  const rows = showTabs ? (tab === "pending" ? pending : resolved) : [...pending, ...resolved];

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h3 className="font-display text-base font-semibold text-ink">{t("escalationsTitle", language)}</h3>
        {showTabs && (
          <div className="flex gap-1 rounded-full bg-paper-alt p-1 text-xs font-medium">
            <button
              onClick={() => setTab("pending")}
              className={`rounded-full px-3 py-1 ${tab === "pending" ? "bg-white shadow-sm text-ink" : "text-muted"}`}
            >
              {t("pendingTab", language)} ({pending.length})
            </button>
            <button
              onClick={() => setTab("resolved")}
              className={`rounded-full px-3 py-1 ${tab === "resolved" ? "bg-white shadow-sm text-ink" : "text-muted"}`}
            >
              {t("resolvedTab", language)} ({resolved.length})
            </button>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted">
          {showTabs && tab === "resolved" ? t("noResolvedRequests", language) : t("noPendingRequests", language)}
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className={tableHeaderClass(language)}>
            <tr>
              <th className="px-4 py-3">{t("parentStudentCol", language)}</th>
              <th className="px-4 py-3">{t("requestTypeCol", language)}</th>
              <th className="px-4 py-3">{t("messageCol", language)}</th>
              <th className="px-4 py-3">{t("dateCol", language)}</th>
              <th className="px-4 py-3">{t("actionCol", language)}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((req) => (
              <EscalationRow
                key={req.id}
                req={req}
                token={token}
                onResolved={onRefresh}
                resolvable={resolvable}
                canForward={canForward}
                canMessage={canMessage}
                language={language}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
