import React, { useState } from "react";
import { t } from "../utils/i18n.js";
import AttendanceHistoryModal from "./AttendanceHistoryModal.jsx";

function pctTone(pct) {
  if (pct >= 90) return "text-success";
  if (pct >= 75) return "text-marigold-deep";
  return "text-danger";
}

export function AttendanceCard({ name, subtitle, pct, considered, absent, recent, accent, language = "en", token }) {
  const [showHistory, setShowHistory] = useState(false);
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-lg font-semibold text-ink">{name}</p>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        <span className={`font-display text-3xl font-semibold ${pctTone(pct)}`}>{pct}%</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted">
        <span>{considered} {t("daysConsideredLabel", language)}</span>
        <span>{absent} {t("absentCountLabel", language)}</span>
        {token && (
          <button
            onClick={() => setShowHistory(true)}
            className="text-xs font-medium text-marigold-deep underline-offset-2 hover:underline"
          >
            {t("viewFullAttendanceBtn", language)}
          </button>
        )}
      </div>
      {recent && recent.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1">
          {recent.slice(0, 10).map((r) => (
            <span
              key={r.date}
              title={`${r.date}: ${r.status === "present" ? t("presentStatus", language) : t("absentStatus", language)}`}
              className={`h-2.5 w-2.5 rounded-full ${
                r.status === "present" ? "bg-success" : "bg-danger"
              }`}
            />
          ))}
        </div>
      )}
      {accent && <div className="mt-4 h-1 rounded-full" style={{ background: accent }} />}

      {showHistory && (
        <AttendanceHistoryModal studentName={name} token={token} onClose={() => setShowHistory(false)} />
      )}
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
