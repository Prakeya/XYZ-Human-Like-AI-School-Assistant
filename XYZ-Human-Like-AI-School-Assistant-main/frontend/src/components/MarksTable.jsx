import React, { useState } from "react";
import { api, ApiError } from "../api.js";
import { useLanguage } from "../context/LanguageContext.jsx";
import { t } from "../utils/i18n.js";

/**
 * Read-only marks table, used on Student/Parent dashboards and (read-only)
 * inside the Teacher marks-entry panel below.
 */
export function MarksTable({ marks = [], language }) {
  if (!marks.length) {
    return <p className="px-4 py-6 text-center text-sm text-muted">{t("noMarksYet", language)}</p>;
  }
  return (
    <table className="w-full text-sm">
      <thead className="bg-paper-alt text-left text-xs uppercase tracking-wide text-muted">
        <tr>
          <th className="px-4 py-3">{t("subjectCol", language)}</th>
          <th className="px-4 py-3">{t("termCol", language)}</th>
          <th className="px-4 py-3">{t("scoreCol", language)}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {marks.map((m) => (
          <tr key={m.id}>
            <td className="px-4 py-3 font-medium text-ink-text">{m.subject}</td>
            <td className="px-4 py-3 text-muted">{m.term}</td>
            <td className="px-4 py-3">
              <span
                className={`font-semibold ${
                  m.percentage >= 75 ? "text-success" : m.percentage >= 40 ? "text-marigold-deep" : "text-danger"
                }`}
              >
                {m.score}/{m.max_score}
              </span>
              <span className="ml-1.5 text-xs text-muted">({m.percentage}%)</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Teacher-only: pick a student from the roster, view their marks, and add a
 * new mark. Fetches on demand rather than bloating the main dashboard payload.
 */
export function TeacherMarksPanel({ roster = [], token }) {
  const { language } = useLanguage();
  const [studentName, setStudentName] = useState(roster[0]?.student_name || "");
  const [marks, setMarks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ subject: "", term: "", score: "", max_score: "100" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const loadMarks = async (name) => {
    if (!name) return;
    setLoading(true);
    try {
      const res = await api.getMarks(token, name);
      setMarks(res.marks || []);
    } catch {
      setMarks([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadMarks(studentName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentName]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!studentName || !form.subject || !form.term || form.score === "") return;
    setSaving(true);
    setError(null);
    try {
      await api.addMarks(token, {
        student_name: studentName,
        subject: form.subject,
        term: form.term,
        score: Number(form.score),
        max_score: Number(form.max_score) || 100,
      });
      setForm({ subject: "", term: "", score: "", max_score: "100" });
      loadMarks(studentName);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save marks.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="border-b border-line px-4 py-3">
        <h3 className="font-display text-base font-semibold text-ink">{t("marksTitle", language)}</h3>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <select
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
          className="rounded-lg border border-line px-2.5 py-1.5 text-sm"
        >
          {roster.map((s) => (
            <option key={s.student_name} value={s.student_name}>
              {s.student_name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="px-4 py-6 text-center text-sm text-muted">…</p>
      ) : (
        <MarksTable marks={marks} language={language} />
      )}

      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2 border-t border-line bg-paper-alt/40 px-4 py-3">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-muted">{t("subjectCol", language)}</label>
          <input
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            className="w-28 rounded-lg border border-line px-2 py-1.5 text-sm"
            placeholder="Science"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-muted">{t("termCol", language)}</label>
          <input
            value={form.term}
            onChange={(e) => setForm((f) => ({ ...f, term: e.target.value }))}
            className="w-24 rounded-lg border border-line px-2 py-1.5 text-sm"
            placeholder="Term 1"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-muted">{t("scoreCol", language)}</label>
          <input
            type="number"
            value={form.score}
            onChange={(e) => setForm((f) => ({ ...f, score: e.target.value }))}
            className="w-20 rounded-lg border border-line px-2 py-1.5 text-sm"
            placeholder="88"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-muted">Max</label>
          <input
            type="number"
            value={form.max_score}
            onChange={(e) => setForm((f) => ({ ...f, max_score: e.target.value }))}
            className="w-20 rounded-lg border border-line px-2 py-1.5 text-sm"
            placeholder="100"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-ink px-3.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {saving ? t("savingBtn", language) : t("addMarksBtn", language)}
        </button>
        {error && <p className="w-full text-xs text-danger">{error}</p>}
      </form>
    </div>
  );
}

export default MarksTable;
