import React from "react";
import { StatTile } from "../components/AttendanceCard.jsx";
import EscalationsTable from "../components/EscalationsTable.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { t } from "../utils/i18n.js";

export default function TeacherDashboard({ data, token, onRefresh }) {
  const { language } = useLanguage();
  const roster = data.roster || [];
  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatTile label={t("assignedClassesLabel", language)} value={(data.assigned_classes || []).join(", ") || "—"} />
        <StatTile label={t("studentsLabel", language)} value={roster.length} />
        <StatTile
          label={t("below80Label", language)}
          value={roster.filter((s) => s.attendance_percentage < 80).length}
          tone="text-danger"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-paper-alt text-left text-xs uppercase tracking-wide text-muted">
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
                <td className="px-4 py-3">
                  <span
                    className={`font-semibold ${
                      s.attendance_percentage >= 90
                        ? "text-success"
                        : s.attendance_percentage >= 75
                        ? "text-marigold-deep"
                        : "text-danger"
                    }`}
                  >
                    {s.attendance_percentage}%
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">{s.days_absent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted">{t("markAttendanceHint", language)}</p>

      <div className="mt-6">
        <EscalationsTable escalations={data.escalations} token={token} onRefresh={onRefresh} showTabs />
      </div>
    </div>
  );
}
