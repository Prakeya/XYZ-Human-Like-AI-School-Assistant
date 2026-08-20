import React, { useState } from "react";
import { AttendanceCard } from "../components/AttendanceCard.jsx";
import { MarksTable } from "../components/MarksTable.jsx";
import MessagesPanel from "../components/MessagesPanel.jsx";
import { api, ApiError } from "../api.js";
import { useLanguage } from "../context/LanguageContext.jsx";
import { t, tableHeaderClass } from "../utils/i18n.js";

function requestTypeLabel(reqType, language) {
  if (reqType === "teacher_call") return t("talkToTeacher", language);
  if (reqType === "management_support") return t("contactManagement", language);
  return reqType;
}

function statusBadge(req, language) {
  if (req.status === "resolved") {
    return <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">{t("resolvedBadge", language)}</span>;
  }
  if (req.forwarded_to_principal) {
    return <span className="rounded-full bg-role-principal/10 px-2.5 py-1 text-xs font-medium text-role-principal">{t("forwardedBadge", language)}</span>;
  }
  return <span className="rounded-full bg-paper-alt px-2.5 py-1 text-xs font-medium text-muted">{t("pendingBadge", language)}</span>;
}

/**
 * Manual "Raise a request" form -- the form equivalent of the chat "Talk to
 * Teacher" / "Contact School Management" confirm flow (spec section 3), for
 * a parent who'd rather fill in a form than type it to the assistant. Posts
 * to the same backend tools via POST /support (see api.createSupportRequest).
 */
function RaiseRequestForm({ kids, token, language, onDone }) {
  const [open, setOpen] = useState(false);
  const [requestType, setRequestType] = useState("teacher_call");
  const [studentName, setStudentName] = useState(kids[0]?.student_name || "");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!open) {
    return (
      <div className="border-t border-line px-4 py-3">
        <button
          onClick={() => setOpen(true)}
          className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-white"
        >
          {t("raiseRequestBtn", language)}
        </button>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.createSupportRequest(token, {
        request_type: requestType,
        student_name: requestType === "teacher_call" ? studentName || undefined : undefined,
        message: message.trim() || undefined,
      });
      setMessage("");
      setOpen(false);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("requestSubmitError", language));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border-t border-line bg-paper-alt/40 px-4 py-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">{t("requestTypeLabel", language)}</label>
        <select
          value={requestType}
          onChange={(e) => setRequestType(e.target.value)}
          className="w-full rounded-lg border border-line px-2.5 py-1.5 text-sm sm:w-auto"
        >
          <option value="teacher_call">{t("talkToTeacher", language)}</option>
          <option value="management_support">{t("contactManagement", language)}</option>
        </select>
      </div>

      {requestType === "teacher_call" && kids.length > 1 && (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">{t("aboutChildLabel", language)}</label>
          <select
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            className="w-full rounded-lg border border-line px-2.5 py-1.5 text-sm sm:w-auto"
          >
            {kids.map((c) => (
              <option key={c.student_name} value={c.student_name}>
                {c.student_name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-muted">{t("requestMessageLabel", language)}</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("requestMessagePlaceholder", language)}
          rows={3}
          className="w-full rounded-lg border border-line px-2.5 py-1.5 text-sm"
        />
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
        >
          {submitting ? t("submittingBtn", language) : t("submitRequestBtn", language)}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-line px-4 py-2 text-xs font-medium text-ink-text"
        >
          {t("cancelBtn", language)}
        </button>
      </div>
    </form>
  );
}

export default function ParentDashboard({ data, token, currentUserId, onRefresh }) {
  const { language } = useLanguage();
  const children = data.children || [];
  const myComplaints = data.my_complaints || { pending: [], resolved: [] };
  const allComplaints = [...myComplaints.pending, ...myComplaints.resolved];
  const contacts = data.contacts || [];
  const [justSubmitted, setJustSubmitted] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-sm text-muted">
          {children.length} {t("linkedChildrenNote", language)}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {children.map((child) => (
            <AttendanceCard
              key={child.student_name}
              name={child.student_name}
              subtitle={child.class_name}
              pct={child.attendance_percentage}
              considered={child.days_considered}
              absent={child.days_absent}
              recent={child.recent_records}
              accent="#A65D3E"
              language={language}
              token={token}
            />
          ))}
        </div>
      </div>

      {children.map((child) => (
        <div key={child.student_name} className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="border-b border-line px-4 py-3">
            <h3 className="font-display text-base font-semibold text-ink">
              {t("marksTitle", language)} — {child.student_name}
            </h3>
          </div>
          <MarksTable marks={child.marks || []} language={language} />
        </div>
      ))}

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="border-b border-line px-4 py-3">
          <h3 className="font-display text-base font-semibold text-ink">{t("myComplaintsTitle", language)}</h3>
        </div>
        {justSubmitted && (
          <p className="border-b border-line bg-success/10 px-4 py-2 text-xs font-medium text-success">
            {t("requestSubmittedNote", language)}
          </p>
        )}
        {allComplaints.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">{t("noComplaintsYet", language)}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className={tableHeaderClass(language)}>
              <tr>
                <th className="px-4 py-3">{t("requestTypeCol", language)}</th>
                <th className="px-4 py-3">{t("dateCol", language)}</th>
                <th className="px-4 py-3">{t("actionCol", language)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {allComplaints.map((req) => (
                <tr key={req.id}>
                  <td className="px-4 py-3 font-medium text-ink-text">
                    {requestTypeLabel(req.request_type, language)}
                    {req.student_name && <span className="block text-xs text-muted">{t("reLabel", language)} {req.student_name}</span>}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {req.created_at ? new Date(req.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">{statusBadge(req, language)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <RaiseRequestForm
          kids={children}
          token={token}
          language={language}
          onDone={async () => {
            setJustSubmitted(true);
            if (onRefresh) await onRefresh();
            setTimeout(() => setJustSubmitted(false), 6000);
          }}
        />
      </div>

      <MessagesPanel
        title={t("messagesTitle", language)}
        contacts={contacts}
        token={token}
        currentUserId={currentUserId}
      />
    </div>
  );
}
