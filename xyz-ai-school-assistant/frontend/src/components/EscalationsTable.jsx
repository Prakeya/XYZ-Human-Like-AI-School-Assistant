import React, { useState } from "react";
import { api, ApiError } from "../api.js";
import { useLanguage } from "../context/LanguageContext.jsx";
import { t } from "../utils/i18n.js";

function requestTypeLabel(reqType, language) {
  if (reqType === "teacher_call") return t("talkToTeacher", language);
  if (reqType === "management_support") return t("contactManagement", language);
  return reqType;
}

/**
 * Renders one escalation/complaint row. Kept separate so the Resolve button's
 * own in-flight/error state doesn't re-render the whole table.
 */
function EscalationRow({ req, token, onResolved, resolvable, language }) {
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState(null);

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

  return (
    <tr>
      <td className="px-4 py-3 font-medium text-ink-text">
        {req.requester_name}
        {req.student_name && <span className="block text-xs text-muted">re: {req.student_name}</span>}
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
        ) : resolvable ? (
          <div>
            <button
              onClick={handleResolve}
              disabled={resolving}
              className="rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {resolving ? t("resolvingBtn", language) : t("resolveBtn", language)}
            </button>
            {error && <p className="mt-1 text-xs text-danger">{error}</p>}
          </div>
        ) : (
          <span className="rounded-full bg-paper-alt px-2.5 py-1 text-xs font-medium text-muted">
            {t("pendingBadge", language)}
          </span>
        )}
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
 */
export default function EscalationsTable({ escalations, token, onRefresh, resolvable = true, showTabs = false }) {
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
          <thead className="bg-paper-alt text-left text-xs uppercase tracking-wide text-muted">
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
                language={language}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
