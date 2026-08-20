# Fixes in this round (latest)

## 1. Non-English text looked "improper" -- missing script fonts

**Root cause:** `frontend/index.html` only loaded Fraunces, Inter and IBM
Plex Mono -- all Latin-only typefaces. None of them contain glyphs for
Devanagari, Tamil, Telugu, Bengali, Gujarati, Gurmukhi, Kannada, Malayalam
or Arabic (Urdu). The translated *strings* were already correct and
complete (every one of the 146 frontend keys and 36 backend response
templates has all 11 languages filled in -- verified programmatically),
but with no matching web font, the browser fell back to whatever font (if
any) the OS happened to have installed for that script -- inconsistent
weights next to the Latin UI chrome, and on some devices/browsers, missing
or broken glyph shaping.

**Fix:** added Noto Sans Devanagari/Tamil/Telugu/Bengali/Gujarati/
Gurmukhi/Kannada/Malayalam/Arabic to the Google Fonts `<link>` in
`index.html`, and appended them (each only carries glyphs for its own
script) to both the `display` and `body` font stacks in
`tailwind.config.js`. The browser now resolves each character to the
first font in the stack that actually has a glyph for it: English keeps
Fraunces/Inter, every other language gets the matching Noto Sans subset
instead of an unpredictable OS fallback.

## 2. Voice input did nothing when tapped

**Root cause:** `frontend/src/hooks/useSpeech.js`'s `recognition.onerror`
handler only did `setListening(false)` -- if the mic permission was
denied, no microphone was present, the speech service was unreachable, or
(most commonly for a deployed build) the page wasn't served over a secure
context (`https://`, or `localhost`) -- which `SpeechRecognition.start()`
requires -- the button silently reset to idle with zero feedback. Calling
`.start()` was also not wrapped in try/catch, so a stray double-tap
(`InvalidStateError`) failed silently too.

**Fix:**
- Added a `window.isSecureContext` check so the button correctly reports
  itself unsupported (with a specific reason) when served over plain
  `http://` instead of pretending voice will work and then doing nothing.
- `recognition.onerror` now sets a `micError` reason (`not-allowed`,
  `audio-capture`, `network`, etc.) that `ChatPanel.jsx` surfaces as a
  translated message under the input bar, in all 11 languages
  (`micErrorInsecureContext`, `micErrorNotAllowed`, `micErrorNoMic`,
  `micErrorNetwork`, `micErrorGeneric` in `utils/i18n.js`).
- `recognition.start()` is now wrapped in try/catch.

**Note:** this makes failures visible and diagnosable but can't force a
plain-`http://` deployment to support the microphone -- that's a browser
security requirement, not a bug in this app. If voice still doesn't
prompt for permission after this update, check that the deployed URL
starts with `https://` (or is `localhost`) and that the browser is
Chrome/Edge/Safari (Firefox has no `SpeechRecognition` support at all).

## Verified (this round)
- `cd backend && python -m pytest` → 25/25 passed, unchanged.
- `cd frontend && npm run build` → builds clean, 0 errors.
- Every `t("key", ...)` call in `.jsx` resolves to a key with all 11
  language entries present (146 keys checked programmatically, 0 gaps).
- Every backend `translations.py` template (36 keys) has all 11 languages
  present, 0 gaps.

---

# Fixes in previous round

## 1. Broken glyphs on table headers and the logout button (all non-English languages)

**Root cause:** every `<thead>` (Marks, Escalations, Teacher roster, Principal
tables) and the trace-log toggle used a shared `"uppercase tracking-wide"`
CSS class. The underlying translated strings were always correct — but
`text-transform: uppercase` (and the extra `letter-spacing` from
`tracking-wide`) breaks glyph shaping for Indic scripts: combining vowel
signs (e.g. Tamil "ெ"/"ே", Devanagari matras) get pulled apart from their
base consonant and render as disconnected boxes instead of the actual
letters. This is why "Subject" as "பாடம்" showed as 5 boxes (one per
Unicode code point) and "Log out" as "வெளியேறு" showed as 8.

**Fix:** added `tableHeaderClass(lang)` in `frontend/src/utils/i18n.js`,
which only applies `uppercase tracking-wide` when `lang === "en"`. English
keeps its emphatic all-caps header look; every other language now renders
the plain translated label with correct shaping. Applied to:
- `components/MarksTable.jsx`
- `components/EscalationsTable.jsx`
- `components/TraceRibbon.jsx` (the "How XYZ AI reached this answer" toggle)
- `dashboards/TeacherDashboard.jsx`
- `dashboards/PrincipalDashboard.jsx`
- `dashboards/ParentDashboard.jsx`

No translation content changed — this was a rendering bug, not a missing
translation.

## 2. Parent manual "Raise a request" form

Previously a parent could only start a "Talk to Teacher" / "Contact School
Management" escalation through chat. Added a form on the Parent dashboard's
"My requests" card that posts straight to the backend, using the exact same
tool functions and permission checks as the chat confirm flow.

- **Backend:** `POST /support` (`backend/app/routers/support.py`,
  `SupportRequestCreate` schema in `schemas.py`). Reuses
  `create_teacher_call_request` / `create_management_support_request` from
  `tools.py` — no new business logic, no new permission rules. 3 new tests
  in `tests/test_e2e.py` (create + DB row, invalid type, permission denial).
- **Frontend:** `api.createSupportRequest()` in `api.js`; `RaiseRequestForm`
  component inside `dashboards/ParentDashboard.jsx`. Lets the parent pick
  request type, which child it's about (if more than one), and an optional
  message. On submit, the dashboard refreshes so the new request shows up
  in the table immediately. Fully translated (11 new i18n keys × 11
  languages) in `utils/i18n.js`.

## 3. Teacher marks: switching between students

This already worked in the underlying code (`TeacherMarksPanel`'s `<select>`
lists every student in the teacher's `roster`, e.g. both Arjun and Priya for
Grade 9 - B), but had no visible label, so it wasn't obvious it was a
dropdown. Added a `t("selectStudentLabel", language)` label next to it in
`components/MarksTable.jsx` for clarity.

## Verified

- `cd backend && python -m pytest` → 25/25 passed (22 pre-existing + 3 new).
- `cd frontend && npm run build` → builds clean, 0 errors.
- Every `t("key", ...)` call used in a `.jsx` file resolves to a defined
  key with all 11 language entries present.
