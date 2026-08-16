import React from "react";
import { StatTile } from "../components/AttendanceCard.jsx";

export default function PrincipalDashboard({ data }) {
  const classes = data.class_summary || [];
  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatTile label="Overall attendance" value={`${data.overall_attendance_percentage}%`} tone="text-role-principal" />
        <StatTile label="Classes tracked" value={classes.length} />
        <StatTile label="Needs attention" value={data.lowest_attendance_class || "—"} tone="text-danger" />
      </div>

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
  );
}
