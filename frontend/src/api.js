/**
 * Single client for the existing Phase 1-3 FastAPI backend. No new backend
 * endpoints are invented here -- every call below maps to a route that
 * already exists in backend/app/routers/*.py.
 *
 *   POST /auth/login            -> login(username, password)
 *   GET  /auth/me                -> me(token)
 *   POST /chat                   -> sendMessage(token, {...})
 *   GET  /chat/history/{id}      -> getHistory(token, conversationId)
 *   GET  /dashboard              -> getDashboard(token)
 *   POST /support                -> createSupportRequest(token, {...})
 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = "GET", token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    throw new ApiError(
      "Can't reach the XYZ AI backend. Is it running at " + BASE_URL + "?",
      0
    );
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // no/invalid JSON body
  }

  if (!res.ok) {
    const detail = (data && data.detail) || `Request failed (${res.status})`;
    throw new ApiError(detail, res.status);
  }
  return data;
}

export const api = {
  login: (username, password) =>
    request("/auth/login", { method: "POST", body: { username, password } }),

  me: (token) => request("/auth/me", { token }),

  sendMessage: (token, { message, language, conversationId }) =>
    request("/chat", {
      method: "POST",
      token,
      body: { message, language, conversation_id: conversationId ?? null },
    }),

  getHistory: (token, conversationId) =>
    request(`/chat/history/${conversationId}`, { token }),

  getDashboard: (token) => request("/dashboard", { token }),

  resolveEscalation: (token, requestId) =>
    request(`/support/${requestId}/resolve`, { method: "PATCH", token }),

  forwardEscalation: (token, requestId) =>
    request(`/support/${requestId}/forward`, { method: "PATCH", token }),

  getMyRequests: (token) => request("/support/mine", { token }),

  createSupportRequest: (token, payload) =>
    request("/support", { method: "POST", token, body: payload }),

  getAttendanceHistory: (token, studentName) =>
    request(`/dashboard/attendance-history${studentName ? `?student_name=${encodeURIComponent(studentName)}` : ""}`, { token }),

  getMarks: (token, studentName) =>
    request(`/marks${studentName ? `?student_name=${encodeURIComponent(studentName)}` : ""}`, { token }),

  addMarks: (token, payload) =>
    request("/marks", { method: "POST", token, body: payload }),

  getContacts: (token) => request("/messages/contacts", { token }),

  getMessageThread: (token, otherUserId) =>
    request(`/messages/${otherUserId}`, { token }),

  sendDirectMessage: (token, payload) =>
    request("/messages", { method: "POST", token, body: payload }),
};

export { ApiError, BASE_URL };
