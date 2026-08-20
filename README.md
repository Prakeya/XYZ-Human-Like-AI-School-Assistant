# XYZ AI — Human-Like AI School Assistant

Bharat Academix AI & Machine Learning Competition 2026 — Round 2 submission.

A role-aware school assistant with a conversational AI layer on top of a real
permission engine and mock school data — not an LLM inventing answers. Students,
parents, teachers, and principals each get a dashboard scoped to what their role
is allowed to see, plus a chat assistant that can answer questions about
attendance and academics in natural language, across 11 languages.

```
User -> AI Orchestrator -> Intent Detection -> Permission Engine
      -> Tool / Mock API -> Result -> Natural Language Response
```

---

## What it does

| Role | Can do |
|---|---|
| **Student** | View their own attendance and marks, ask the assistant about either, message their teacher |
| **Parent** | View their linked child's (or children's) attendance and marks, message the teacher, raise a support request |
| **Teacher** | View their class roster, mark attendance, add marks per student, resolve or forward escalations, message parents |
| **Principal** | View school-wide attendance analytics, see the teacher↔principal escalation log |

The chat assistant runs through the same permission engine as the REST API — a
question in chat can never surface more than the equivalent dashboard view would,
regardless of which AI provider is answering it.

---

## Architecture

- **Permission engine is the single source of truth.** Whether a request comes
  from a dashboard fetch or a chat message, it passes through the same
  `permissions.py` checks before touching data. Swapping the AI provider never
  changes what a role is allowed to see.
- **AI provider is pluggable.** `DemoNLUProvider` is a zero-dependency rule
  engine (pattern matching over common phrasings) that works out of the box.
  `AnthropicNLUProvider` calls Claude with tool-calling for genuinely open-ended
  conversation, and falls back to the demo provider if the API call fails.
- **A reply is never assembled from raw model output.** Even in Anthropic mode,
  the LLM only ever selects a tool and its arguments — the sentence shown to the
  user is built from the same translated templates the demo provider uses. This
  is what keeps every language fully supported regardless of which provider is
  active, and keeps the assistant from ever saying something the permission
  engine didn't actually return.
- **Every user-facing string is translated**, not just chat replies — dashboard
  labels, table headers, buttons, and empty states all route through a shared
  translation layer for both frontend (`i18n.js`) and backend (`translations.py`).

```
backend/
  app/
    main.py                FastAPI app, CORS, startup seeding
    routers/                auth, dashboard, chat, marks, support, messages
    permissions.py          role + relationship checks (the authorization boundary)
    tools.py                data-access functions, gated by permissions.py
    intent_engine.py        rule-based intent detection (demo mode)
    ai_provider.py          DemoNLUProvider / AnthropicNLUProvider + tool schema
    ai_orchestrator.py      intent -> permission check -> tool call -> reply
    translations.py         all backend-rendered chat strings, 11 languages
    seed_data.py            demo accounts + sample attendance/marks
frontend/
  src/
    dashboards/              Student / Parent / Teacher / Principal views
    components/               MarksTable, AttendanceCard, EscalationsTable, MessagesPanel, Avatar, ChatPanel, ...
    hooks/useSpeech.js        Web Speech API (speech-to-text + text-to-speech), no API key needed
    utils/i18n.js             all frontend-rendered UI strings, 11 languages
    context/                  auth + language state
    api.js                    thin fetch client, one function per backend route
```

This matches the "School ERP Ecosystem" module structure from the spec (student /
parent / management / staff / xyz-ai portals) implemented as one app with
role-based views rather than five separate repos, since the assistant, permission
engine, and data model are shared across every role.

---

## Supported languages

English, Hindi, Tamil, Telugu, Marathi, Bengali, Gujarati, Punjabi, Kannada,
Malayalam, Urdu — for both the dashboards and the chat assistant. Urdu renders
right-to-left.

---

## Running it locally

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

The first startup creates a local SQLite database and seeds it with demo
accounts, classes, attendance history, and marks — no manual setup needed. API
docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs at `http://localhost:5173` by default and talks to the backend at
`http://localhost:8000` (override with `VITE_API_BASE_URL`).

### Demo accounts

All seed accounts share the password `demo1234`.

| Role | Username |
|---|---|
| Teacher | `teacher.mehta`, `teacher.rao` |
| Principal | `principal.nair` |
| Student | `student.rahul`, `student.ananya`, … |
| Parent | `parent.sharma`, `parent.iyer` |

### Enabling real conversational AI (optional)

By default the assistant runs on `AI_PROVIDER=demo` — a rule-based engine that
recognizes a curated set of common phrasings with zero external dependencies or
cost. To use Claude for genuinely open-ended conversation instead:

```bash
# backend/.env
AI_PROVIDER=anthropic
AI_API_KEY=sk-ant-...
AI_MODEL=claude-sonnet-4-6
```

The tool schema and permission boundary are identical either way — the LLM can
only ever request the same handful of tools (`get_own_attendance`, `get_marks`,
`mark_attendance`, etc.), and every call is re-checked against the requesting
user's role before any data is returned.

---

## Voice and avatar

- **Speech input/output** uses the browser's built-in Web Speech API — no API
  key or paid service required. Falls back gracefully in browsers without
  support.
- **Avatar** has idle / listening / thinking / speaking / error states, a
  distinct glyph per persona (student, parent, teacher, principal), and a
  talking-cadence mouth animation while a reply is being spoken.

---

## Security posture

- Role is derived server-side from the authenticated JWT on every request — it
  is never trusted from client-supplied input, including inside a chat message
  ("I'm actually the principal" does not change what the backend believes).
- Every tool call is re-checked against `permissions.py` regardless of which AI
  provider produced the intent, so a prompt-injection attempt against the LLM
  cannot itself expand what data comes back.
- Permission-denial and clarification messages carry a `reason_key`, not
  translated text, so `permissions.py` and `tools.py` never need to know what
  language the user is in — `translations.py` is the only place that turns a
  reason into a sentence.

---

## Testing

```bash
cd backend
pytest
```

Covers auth, role-derived permissions across all four roles, the tool layer,
and the chat orchestrator end-to-end (intent → permission → tool → localized
reply).

```bash
cd frontend
npm run build
```

Produces a clean production bundle.

---

## Design notes

- **Demo mode is intentionally rule-based, not a small language model.** It
  recognizes attendance and marks questions, common follow-ups ("what about
  this week?", "how can I improve?"), and confirmations, but it isn't going to
  hold an unscripted conversation — that's what `AI_PROVIDER=anthropic` is for.
  If a phrasing it doesn't recognize comes up often in testing, the fix is
  almost always a one-line pattern addition in `intent_engine.py`, not a
  rewrite.
- **Marks/academics questions and open-ended follow-ups** ("how can I improve
  it?") are handled the same way attendance questions are: pattern-matched to
  an intent, resolved against the previous turn's topic when the question has
  no topic of its own, and answered through the same permission-checked tool
  layer — so a parent asking "how is my child doing academically?" gets the
  same treatment as "what's my child's attendance?".

---

## Known limitations

- The demo AI provider's phrasing coverage is broad but not exhaustive;
  genuinely novel phrasings fall through to a clarifying "I'm not sure I
  follow" reply that lists what it can help with.
- SQLite is used for local/demo simplicity — not intended for concurrent
  multi-instance deployment as-is.
- CORS is wide open (`allow_origins=["*"]`) for local development; restrict
  this before any real deployment.
