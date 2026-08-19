import React from "react";
import { AttendanceCard } from "../components/AttendanceCard.jsx";
import { MarksTable } from "../components/MarksTable.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { t } from "../utils/i18n.js";

export default function StudentDashboard({ data, token }) {
  const { language } = useLanguage();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <AttendanceCard
        name={data.student_name}
        subtitle={data.class_name}
        pct={data.attendance_percentage}
        considered={data.days_considered}
        absent={data.days_absent}
        recent={data.recent_records}
        accent="#3E7CB1"
        language={language}
        token={token}
      />
      <div className="rounded-2xl border border-line bg-white p-5">
        <p className="font-display text-lg font-semibold text-ink">{t("recentDays", language)}</p>
        <ul className="mt-3 divide-y divide-line text-sm">
          {(data.recent_records || []).map((r) => (
            <li key={r.date} className="flex items-center justify-between py-2">
              <span className="text-ink-text">{r.date}</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                  r.status === "present" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                }`}
              >
                {r.status === "present" ? t("presentStatus", language) : t("absentStatus", language)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white md:col-span-2">
        <div className="border-b border-line px-4 py-3">
          <h3 className="font-display text-base font-semibold text-ink">{t("marksTitle", language)}</h3>
        </div>
        <MarksTable marks={data.marks || []} language={language} />
      </div>
    </div>
  );
}
