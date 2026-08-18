import React from "react";
import { StatTile } from "../components/AttendanceCard.jsx";
import EscalationsTable from "../components/EscalationsTable.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { t } from "../utils/i18n.js";

export default function PrincipalDashboard({ data, token, onRefresh }) {
  const { language } = useLanguage();
  const classes = data.class_summary || [];
  const teachers = data.teachers || [];

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label={t("totalStudentsLabel", language)} value={data.total_students ?? "—"} />
        <StatTile label={t("totalTeachersLabel", language)} value={data.total_teachers ?? "—"} />
        <StatTile label={t("overallAttendanceLabel", language)} value={`${data.overall_attendance_percentage}%`} tone="text-role-principal" />
        <StatTile
          label={t("pendingEscalationsLabel", language)}
          value={data.pending_escalation_count ?? 0}
          tone={data.pending_escalation_count ? "text-danger" : "text-ink"}
        />
      </div>

      <div className="mb-6 overflow-hidden rounded-2xl border border-line bg-white">
        <div className="border-b border-line px-4 py-3">
          <h3 className="font-display text-base font-semibold text-ink">{t("allTeachersLabel", language)}</h3>
        </div>
        {teachers.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">{t("noTeachersOnRecord", language)}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-paper-alt text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">{t("teacherCol", language)}</th>
                <th className="px-4 py-3">{t("assignedClassesLabel", language)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {teachers.map((tch) => (
                <tr key={tch.name}>
                  <td className="px-4 py-3 font-medium text-ink-text">{tch.name}</td>
                  <td className="px-4 py-3 text-muted">{tch.assigned_classes.join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mb-6">
        <h3 className="mb-3 font-display text-base font-semibold text-ink">{t("allStudentsLabel", language)}</h3>
        <div className="space-y-4">
          {classes.map((c) => (
            <div key={c.class_name} className="rounded-2xl border border-line bg-white p-5">
              <div className="flex items-center justify-between">
                <p className="font-display text-lg font-semibold text-ink">{c.class_name}</p>
                <span
                  className={`font-display text-2xl font-semibold ${
                    c.attendance_percentage >= 90
                      ? "text-success"
                      : c.attendance_percentage >= 75
                      ? "text-marigold-deep"
                      : "text-danger"
                  }`}
                >
                  {c.attendance_percentage}%
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {c.students.map((s) => (
                  <span
                    key={s.name}
                    className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-text"
                    title={`${s.attendance_percentage}%`}
                  >
                    {s.name} · {s.attendance_percentage}%
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <EscalationsTable escalations={data.escalations} token={token} onRefresh={onRefresh} showTabs />
    </div>
  );
}
