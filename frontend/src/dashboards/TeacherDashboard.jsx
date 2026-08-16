import React from "react";
import { StatTile } from "../components/AttendanceCard.jsx";

export default function TeacherDashboard({ data }) {
  const roster = data.roster || [];
  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatTile label="Assigned classes" value={(data.assigned_classes || []).join(", ") || "—"} />
        <StatTile label="Students" value={roster.length} />
        <StatTile
          label="Below 80% attendance"
          value={roster.filter((s) => s.attendance_percentage < 80).length}
          tone="text-danger"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-paper-alt text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Class</th>
              <th className="px-4 py-3">Attendance</th>
              <th className="px-4 py-3">Days absent</th>
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

      <p className="mt-3 text-xs text-muted">
        To mark attendance, use the XYZ AI assistant — e.g. "Mark Rahul absent today."
      </p>
    </div>
  );
}
