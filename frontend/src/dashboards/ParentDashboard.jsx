import React from "react";
import { AttendanceCard } from "../components/AttendanceCard.jsx";
import { MarksTable } from "../components/MarksTable.jsx";
import MessagesPanel from "../components/MessagesPanel.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { t } from "../utils/i18n.js";

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

export default function ParentDashboard({ data, token, currentUserId }) {
  const { language } = useLanguage();
  const children = data.children || [];
  const myComplaints = data.my_complaints || { pending: [], resolved: [] };
  const allComplaints = [...myComplaints.pending, ...myComplaints.resolved];
  const contacts = data.contacts || [];

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
        {allComplaints.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">{t("noComplaintsYet", language)}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-paper-alt text-left text-xs uppercase tracking-wide text-muted">
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
                    {req.student_name && <span className="block text-xs text-muted">re: {req.student_name}</span>}
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
