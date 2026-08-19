import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, ApiError } from "../api.js";

const AuthContext = createContext(null);

const STORAGE_KEY = "xyzai_token";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount / whenever the token changes, resolve the actual user from the
  // backend rather than trusting anything decoded on the client -- the
  // backend is the sole source of truth for role (see auth.py / deps.py).
  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const me = await api.me(token);
        if (!cancelled) setUser(me);
      } catch (err) {
        if (!cancelled) {
          setUser(null);
          setToken(null);
          localStorage.removeItem(STORAGE_KEY);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    resolve();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = useCallback(async (username, password) => {
    const res = await api.login(username, password);
    localStorage.setItem(STORAGE_KEY, res.access_token);
    setToken(res.access_token);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("xyzai_conversation_id");
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { ApiError };
