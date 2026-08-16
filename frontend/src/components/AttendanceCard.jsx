import React from "react";

function pctTone(pct) {
  if (pct >= 90) return "text-success";
  if (pct >= 75) return "text-marigold-deep";
  return "text-danger";
}

export function AttendanceCard({ name, subtitle, pct, considered, absent, recent, accent }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-lg font-semibold text-ink">{name}</p>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        <span className={`font-display text-3xl font-semibold ${pctTone(pct)}`}>{pct}%</span>
      </div>
      <div className="mt-3 flex gap-4 text-xs text-muted">
        <span>{considered} days considered</span>
        <span>{absent} absent</span>
      </div>
      {recent && recent.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1">
          {recent.slice(0, 10).map((r) => (
            <span
              key={r.date}
              title={`${r.date}: ${r.status}`}
              className={`h-2.5 w-2.5 rounded-full ${
                r.status === "present" ? "bg-success" : "bg-danger"
              }`}
            />
          ))}
        </div>
      )}
      {accent && <div className="mt-4 h-1 rounded-full" style={{ background: accent }} />}
    </div>
  );
}

export function StatTile({ label, value, tone = "text-ink" }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 font-display text-3xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}
