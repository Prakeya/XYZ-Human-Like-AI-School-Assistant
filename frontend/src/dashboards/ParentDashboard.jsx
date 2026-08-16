import React from "react";
import { AttendanceCard } from "../components/AttendanceCard.jsx";

export default function ParentDashboard({ data }) {
  const children = data.children || [];
  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        {children.length} child{children.length === 1 ? "" : "ren"} linked to your account.
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
          />
        ))}
      </div>
    </div>
  );
}
