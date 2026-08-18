import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { api, ApiError } from "../api.js";
import { personaFor } from "../utils/personas.js";
import { t, dirFor } from "../utils/i18n.js";
import Avatar from "../components/Avatar.jsx";
import ChatPanel from "../components/ChatPanel.jsx";
import LanguageSelector from "../components/LanguageSelector.jsx";
import StudentDashboard from "../dashboards/StudentDashboard.jsx";
import ParentDashboard from "../dashboards/ParentDashboard.jsx";
import TeacherDashboard from "../dashboards/TeacherDashboard.jsx";
import PrincipalDashboard from "../dashboards/PrincipalDashboard.jsx";

const DASHBOARD_BY_ROLE = {
  student: StudentDashboard,
  parent: ParentDashboard,
  teacher: TeacherDashboard,
  principal: PrincipalDashboard,
};

export default function Shell() {
  const { user, token, logout } = useAuth();
  const { language } = useLanguage();
  const persona = personaFor(user?.role);

  const [view, setView] = useState("dashboard"); // "dashboard" | "assistant"
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardError, setDashboardError] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingDashboard(true);
      setDashboardError(null);
      try {
        const res = await api.getDashboard(token);
        if (!cancelled) setDashboardData(res);
      } catch (err) {
        if (!cancelled) {
          setDashboardError(err instanceof ApiError ? err.message : "Couldn't load dashboard data.");
        }
      } finally {
        if (!cancelled) setLoadingDashboard(false);
      }
    }
    if (token) load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const DashboardComponent = DASHBOARD_BY_ROLE[user?.role];

  const nav = [
    { key: "dashboard", label: t("dashboard", language), icon: "▦" },
    { key: "assistant", label: t("assistant", language), icon: "✦" },
  ];

  return (
    <div dir={dirFor(language)} className="flex min-h-screen flex-col bg-paper md:flex-row">
      {/* Sidebar (desktop) */}
      <aside
        className="hidden w-60 shrink-0 flex-col justify-between border-r border-line bg-white px-4 py-6 md:flex"
        style={{ borderTop: `4px solid ${persona.color}` }}
      >
        <div>
          <div className="flex items-center gap-2 px-2">
            <span className="font-display text-lg font-semibold text-ink">{t("appName", language)}</span>
          </div>

          <div className="mt-6 flex items-center gap-3 rounded-xl bg-paper-alt px-3 py-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ background: persona.color }}
            >
              {persona.initial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink-text">{user?.full_name}</p>
              <p className="text-xs text-muted">{persona.label}</p>
            </div>
          </div>

          <nav className="mt-6 space-y-1">
            {nav.map((n) => (
              <button
                key={n.key}
                onClick={() => setView(n.key)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  view === n.key ? "text-white" : "text-ink-text hover:bg-paper-alt"
                }`}
                style={view === n.key ? { background: persona.color } : {}}
              >
                <span>{n.icon}</span>
                {n.label}
              </button>
            ))}
          </nav>
        </div>

        <div>
          <div className="mb-3">
            <LanguageSelector />
          </div>
          <button
            onClick={logout}
            className="w-full rounded-xl border border-line px-3 py-2.5 text-sm font-medium text-ink-text hover:bg-paper-alt"
          >
            {t("logout", language)}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-white px-5 py-3 md:hidden">
          <span className="font-display text-lg font-semibold text-ink">{t("appName", language)}</span>
          <Avatar state="idle" color={persona.color} size={32} />
        </header>

        <div className="flex-1 overflow-y-auto p-4 pb-24 md:p-6 md:pb-6">
          {view === "dashboard" ? (
            <div>
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h1 className="font-display text-2xl font-semibold text-ink">{persona.label} {t("dashboard", language)}</h1>
                  <p className="text-sm text-muted">{t("liveDataNote", language)}</p>
                </div>
                <div className="hidden md:block">
                  <button
                    onClick={() => setView("assistant")}
                    className="rounded-full px-4 py-2 text-sm font-medium text-white"
                    style={{ background: persona.color }}
                  >
                    {t("askPrefix", language)} {t("appName", language)} →
                  </button>
                </div>
              </div>

              {loadingDashboard && <p className="text-sm text-muted">Loading dashboard…</p>}
              {dashboardError && <p className="text-sm text-danger">{dashboardError}</p>}
              {dashboardData && DashboardComponent && (
                <DashboardComponent
                  data={dashboardData.data}
                  token={token}
                  onRefresh={async () => {
                    try {
                      const res = await api.getDashboard(token);
                      setDashboardData(res);
                    } catch (err) {
                      setDashboardError(err instanceof ApiError ? err.message : "Couldn't refresh dashboard data.");
                    }
                  }}
                />
              )}
            </div>
          ) : (
            <div className="h-[calc(100vh-9rem)] md:h-[calc(100vh-3rem)]">
              <ChatPanel />
            </div>
          )}
        </div>

        {/* Bottom nav (mobile) */}
        <nav className="fixed bottom-0 left-0 right-0 flex border-t border-line bg-white md:hidden">
          {nav.map((n) => (
            <button
              key={n.key}
              onClick={() => setView(n.key)}
              className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs"
              style={{ color: view === n.key ? persona.color : "#6B7280" }}
            >
              <span className="text-base">{n.icon}</span>
              {n.label}
            </button>
          ))}
          <button
            onClick={logout}
            className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs text-muted"
          >
            <span className="text-base">⏻</span>
            {t("logout", language)}
          </button>
        </nav>
      </main>
    </div>
  );
}
