import React from "react";
import { AttendanceCard } from "../components/AttendanceCard.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { t } from "../utils/i18n.js";

export default function ParentDashboard({ data }) {
  const { language } = useLanguage();
  const children = data.children || [];
  return (
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
          />
        ))}
      </div>
    </div>
  );
}
