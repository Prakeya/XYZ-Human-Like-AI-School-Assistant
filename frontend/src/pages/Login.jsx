import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, ApiError } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { t, dirFor } from "../utils/i18n.js";
import { PERSONAS } from "../utils/personas.js";
import LanguageSelector from "../components/LanguageSelector.jsx";

// Seeded demo accounts from backend/app/seed_data.py -- same DEMO_PASSWORD
// for every account, documented there too. Listed here purely so a judge can
// log in instantly; the credentials still go through the real /auth/login
// endpoint, nothing is faked client-side.
const DEMO_ACCOUNTS = {
  student: [
    { username: "student.rahul", label: "Rahul (Grade 8 - A)" },
    { username: "student.ananya", label: "Ananya (Grade 8 - A)" },
    { username: "student.arjun", label: "Arjun (Grade 9 - B)" },
    { username: "student.priya", label: "Priya (Grade 9 - B)" },
  ],
  parent: [
    { username: "parent.sharma", label: "Mr. Vikram Sharma (Rahul's parent)" },
    { username: "parent.iyer", label: "Mrs. Lakshmi Iyer (Arjun's parent)" },
  ],
  teacher: [
    { username: "teacher.mehta", label: "Ms. Kavita Mehta (Grade 8 - A)" },
    { username: "teacher.rao", label: "Mr. Suresh Rao (Grade 9 - B)" },
  ],
  principal: [{ username: "principal.nair", label: "Dr. Anjali Nair" }],
};
const DEMO_PASSWORD = "demo1234";

export default function Login() {
  const { login } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();

  const [activeRole, setActiveRole] = useState("student");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e?.preventDefault();
    if (!username || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      await login(username, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("invalidLogin", language));
    } finally {
      setSubmitting(false);
    }
  };

  const pickDemoAccount = (acc) => {
    setUsername(acc.username);
    setPassword(DEMO_PASSWORD);
    setError(null);
  };

  return (
    <div dir={dirFor(language)} className="flex min-h-screen items-center justify-center bg-ink px-4 py-10">
      <div className="absolute right-6 top-6">
        <LanguageSelector />
      </div>

      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl bg-paper shadow-2xl md:grid-cols-5">
        {/* Left: brand panel */}
        <div className="relative col-span-2 hidden flex-col justify-between bg-ink p-8 text-white md:flex">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-marigold">
              Bharat Academix · Round 2
            </p>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-tight">
              {t("appName", language)}
            </h1>
            <p className="mt-3 text-sm text-white/70">{t("tagline", language)}</p>
          </div>
          <div className="space-y-2 border-t border-white/10 pt-5">
            {Object.entries(PERSONAS).map(([role, p]) => (
              <div key={role} className="flex items-center gap-2 text-xs text-white/60">
                <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                <span className="font-medium text-white/85">{p.label}</span>
                <span>— {p.tagline}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: login form */}
        <div className="col-span-3 p-8 md:p-10">
          <h2 className="font-display text-2xl font-semibold text-ink">{t("loginTitle", language)}</h2>
          <p className="mt-1 text-sm text-muted">Pick a role below to try a demo account, or sign in directly.</p>

          <div className="mt-5 flex gap-1.5 rounded-full bg-paper-alt p-1">
            {Object.entries(PERSONAS).map(([role, p]) => (
              <button
                key={role}
                onClick={() => setActiveRole(role)}
                className={`flex-1 rounded-full px-2 py-1.5 text-xs font-medium transition-colors ${
                  activeRole === role ? "bg-white shadow text-ink" : "text-muted hover:text-ink-text"
                }`}
                style={activeRole === role ? { color: p.color } : {}}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {DEMO_ACCOUNTS[activeRole].map((acc) => (
              <button
                key={acc.username}
                onClick={() => pickDemoAccount(acc)}
                className={`rounded-lg border px-2.5 py-1.5 text-left text-[11px] leading-tight transition-colors ${
                  username === acc.username
                    ? "border-marigold bg-marigold/10 text-marigold-deep"
                    : "border-line text-muted hover:border-ink/30"
                }`}
              >
                <div className="font-mono">{acc.username}</div>
                <div className="text-ink-text/70">{acc.label}</div>
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-5 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">{t("username", language)}</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-marigold/50"
                placeholder="e.g. parent.sharma"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">{t("password", language)}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-marigold/50"
                placeholder="demo1234"
                autoComplete="current-password"
              />
            </div>

            {error && <p className="text-xs text-danger">{error}</p>}

            <button
              type="submit"
              disabled={submitting || !username || !password}
              className="w-full rounded-xl bg-ink py-2.5 text-sm font-medium text-white transition-opacity hover:bg-ink-light disabled:opacity-40"
            >
              {submitting ? t("signingIn", language) : t("signIn", language)}
            </button>
          </form>

          <p className="mt-4 text-[11px] text-muted">
            {t("demoAccounts", language)}: every seed account uses the password{" "}
            <span className="font-mono text-ink-text">demo1234</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
