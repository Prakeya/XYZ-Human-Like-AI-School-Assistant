# XYZ AI — Human-Like AI School Assistant

**A full-stack, role-aware school assistant — built solo, from database schema to conversational AI.**
Built for the Bharat Academix AI & Machine Learning Competition 2026 (Round 2).

> Four user roles (Student, Parent, Teacher, Principal). One codebase.
> A conversational assistant grounded in a real permission system — not an LLM
> guessing answers. Fully usable in 11 Indian languages, including voice input/output.

---

## 30-second summary

I designed and built a school management platform where a chatbot can answer
questions like *"What's my attendance?"* or *"Mark Rahul absent today"* — but
every answer is backed by an actual authorization check against the user's
real role in the database, not by trusting what the AI decided to say. The
system works two ways out of the box: a **zero-dependency rule-based engine**
for offline/free demo use, and a **Claude-powered mode** with tool-calling for
open-ended conversation — both enforced by the exact same permission layer,
so swapping AI providers can never change what data a user is allowed to see.

---

## Why this project stands out

- **Security-first architecture, not bolted on.** Every chat message and every
  dashboard fetch passes through one shared authorization module
  (`permissions.py`). A user typing *"I'm actually the principal"* into the
  chatbot doesn't change anything — role is derived server-side from the JWT,
  never trusted from input. This is the kind of boundary real production
  systems need and toy projects usually skip.
- **Built for a real evaluation, not just a demo.** 25 passing backend tests
  cover auth, role-scoped permissions across all four roles, the tool layer,
  and the full chat pipeline end-to-end.
- **Genuine internationalization, not a translation plugin.** Every string —
  dashboard labels, table headers, error states, chat replies, even voice
  recognition locale — is translated across **11 languages** (Hindi, Tamil,
  Telugu, Marathi, Bengali, Gujarati, Punjabi, Kannada, Malayalam, Urdu, plus
  English), including full right-to-left layout support for Urdu.
- **Practical AI integration.** Uses Claude's tool-calling to let the model
  choose *which* authorized action to take, but never lets it compose the
  final sentence shown to the user from raw output — replies are always built
  from the same permission-checked, pre-translated templates the offline demo
  engine uses. This avoids both hallucinated answers and untranslatable
  LLM output.
- **Accessible by design.** Voice input/output via the browser's native Web
  Speech API (no paid service, graceful fallback), plus a custom animated
  avatar with distinct idle/listening/thinking/speaking/error states per role.

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI, SQLAlchemy, SQLite, JWT auth, bcrypt |
| Frontend | React 18, Vite, Tailwind CSS, React Router |
| AI | Rule-based NLU engine (zero dependencies) + Claude (Anthropic API) with tool-calling |
| Voice | Web Speech API (speech-to-text + text-to-speech) |
| Testing | Pytest (backend, 25 tests) |
| i18n | Custom translation layer, 11 languages, shared pattern front-and-back-end |

---

## Skills demonstrated

- **API design & authorization** — REST endpoints in FastAPI, a centralized
  role/relationship-based permission engine, JWT-derived identity that can't
  be spoofed from user input (including prompt-injection attempts).
- **Database modeling** — SQLAlchemy models for users, roles, attendance,
  marks, escalations, and messaging, with seeded demo data for instant setup.
- **AI/LLM integration** — tool-calling architecture where the model requests
  actions rather than generating free-form answers, with a provider-agnostic
  interface (swap between an offline rule engine and Claude with no code
  changes elsewhere).
- **Frontend architecture** — React context for auth/language state, a
  reusable component library (tables, cards, chat panel, modals), and a
  translation system that scales to new languages by adding one object, not
  rewriting components.
- **Testing discipline** — end-to-end pytest coverage of the full request
  pipeline (intent → permission check → tool call → localized reply), not
  just unit tests in isolation.
- **Debugging & QA** — this round of changes fixed a real internationalization
  bug (untranslated persona/status strings slipping through the translation
  layer) by tracing it to its root cause and closing the gap systematically
  across every component, rather than patching the one screen that was reported.

---

## What it looks like

- **Student/Parent dashboard** — attendance percentage, day-by-day history,
  marks table, and a chat assistant that can answer "how am I doing?" style
  questions.
- **Teacher dashboard** — class roster, one-click attendance marking, marks
  entry, and an escalation inbox for parent requests.
- **Principal dashboard** — school-wide attendance analytics, teacher roster,
  and an escalation log across the whole school.
- **Chat assistant** — role-specific persona (tone, color, avatar) per user
  type, voice input/output, and a transparency panel that shows exactly which
  permission check and tool call produced each answer.

---

## Try it locally

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` — demo accounts are listed on the login screen
(one click, no signup needed). Every seed account uses the password
`demo1234`.

---

## Full technical documentation

See [`README.md`](./README.md) for architecture details, the full permission
model, how the AI provider switch works, testing instructions, and known
limitations.

---

*Built independently for the Bharat Academix AI & Machine Learning
Competition 2026. Open to walking through any part of the codebase in an
interview — the permission engine and the AI tool-calling boundary are the
parts I'm proudest of.*
