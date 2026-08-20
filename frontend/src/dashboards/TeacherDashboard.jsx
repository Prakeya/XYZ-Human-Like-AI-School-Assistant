import React from "react";
import { StatTile } from "../components/AttendanceCard.jsx";
import EscalationsTable from "../components/EscalationsTable.jsx";
import { TeacherMarksPanel } from "../components/MarksTable.jsx";
import MessagesPanel from "../components/MessagesPanel.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { t, tableHeaderClass } from "../utils/i18n.js";

export default function TeacherDashboard({ data, token, currentUserId, onRefresh }) {
  const { language } = useLanguage();
  const roster = data.roster || [];
  const belowEighty = roster.filter((s) => s.attendance_percentage < 80).length;
  const contacts = data.contacts || [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label={t("assignedClassesLabel", language)} value={(data.assigned_classes || []).join(", ") || "—"} />
        <StatTile label={t("studentsLabel", language)} value={roster.length} />
        <StatTile label={t("pendingEscalationsLabel", language)} value={belowEighty} tone={belowEighty > 0 ? "text-danger" : "text-ink"} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className={tableHeaderClass(language)}>
            <tr>
              <th className="px-4 py-3">{t("studentCol", language)}</th>
              <th className="px-4 py-3">{t("classCol", language)}</th>
              <th className="px-4 py-3">{t("attendanceCol", language)}</th>
              <th className="px-4 py-3">{t("daysAbsentCol", language)}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {roster.map((s) => (
              <tr key={s.student_name}>
                <td className="px-4 py-3 font-medium text-ink-text">{s.student_name}</td>
                <td className="px-4 py-3 text-muted">{s.class_name}</td>
                <td className={`px-4 py-3 font-semibold ${s.attendance_percentage >= 90 ? "text-success" : s.attendance_percentage >= 75 ? "text-marigold-deep" : "text-danger"}`}>
                  {s.attendance_percentage}%
                </td>
                <td className="px-4 py-3 text-muted">{s.days_absent}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-line px-4 py-3 text-xs text-muted">{t("markAttendanceHint", language)}</p>
      </div>

      <TeacherMarksPanel roster={roster} token={token} />

      <EscalationsTable
        escalations={data.escalations}
        token={token}
        onRefresh={onRefresh}
        resolvable
        canForward
        canMessage
        showTabs
      />

      <MessagesPanel
        title={t("messagesTitle", language)}
        contacts={contacts}
        token={token}
        currentUserId={currentUserId}
      />
    </div>
  );
}
