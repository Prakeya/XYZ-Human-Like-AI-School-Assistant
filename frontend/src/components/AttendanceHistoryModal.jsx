import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { useLanguage } from "../context/LanguageContext.jsx";
import { t } from "../utils/i18n.js";

/**
 * Full month-by-month attendance history, opened from AttendanceCard's
 * "View full attendance" link. Fixes the "one stale absence looks like a
 * pattern" problem -- the dashboard card only ever shows the last 10 days.
 */
export default function AttendanceHistoryModal({ studentName, token, onClose }) {
  const { language } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getAttendanceHistory(token, studentName)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setError(t("couldntLoadAttendanceHistory", language));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [studentName, token]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-ink">
            {t("fullAttendanceTitle", language)} — {studentName}
          </h3>
          <button onClick={onClose} className="rounded-full px-2 py-1 text-sm text-muted hover:bg-paper-alt">
            ✕
          </button>
        </div>

        {loading && <p className="text-sm text-muted">…</p>}
        {error && <p className="text-sm text-danger">{error}</p>}

        {data && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              {data.attendance_percentage}% {t("historyOverallLabel", language)} · {data.days_considered} {t("daysConsideredLabel", language)} ·{" "}
              {data.days_absent} {t("absentCountLabel", language)}
            </p>
            {data.months.map((m) => (
              <div key={m.month} className="rounded-xl border border-line p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-medium text-ink-text">{m.month}</p>
                  <p className="text-xs text-muted">
                    {m.attendance_percentage}% · {m.days_absent} {t("absentCountLabel", language)} / {m.days_considered}
                  </p>
                </div>
                <ul className="divide-y divide-line text-sm">
                  {m.records.map((r) => (
                    <li key={r.date} className="flex items-center justify-between py-1.5">
                      <span className="text-ink-text">{r.date}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                          r.status === "present" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                        }`}
                      >
                        {r.status === "present" ? t("presentStatus", language) : t("absentStatus", language)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-xl border border-line py-2 text-sm font-medium text-ink-text hover:bg-paper-alt"
        >
          {t("closeBtn", language)}
        </button>
      </div>
    </div>
  );
}
