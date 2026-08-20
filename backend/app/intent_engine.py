# -*- coding: utf-8 -*-
"""
Intent Detection Engine -- "demo mode" NLU (spec section 15: "the project must
still be usable in demo mode if external AI/voice credentials are unavailable").

This is a deterministic, rule-based natural-language understanding layer that
requires no external API key. It is one implementation of the NLUProvider
interface in ai_provider.py; if AI_PROVIDER=anthropic and AI_API_KEY is set,
AnthropicNLUProvider is used instead -- both produce the same IntentResult
shape, so the orchestrator and the permission/tool layer downstream don't
change based on which is active.

IMPORTANT: nothing detected here is trusted as an authorization decision.
This module only extracts *what the user seems to be asking for* -- the
actual ALLOW/DENY decision always happens later, independently, in
permissions.py / tools.py, using the authenticated user's real role from the
database. Even if this engine is completely fooled by an adversarial
message, the backend tool layer still enforces the real rules.
"""
import re
from dataclasses import dataclass, field
from typing import Optional, List


@dataclass
class IntentResult:
    intent: str
    entities: dict = field(default_factory=dict)
    flags: dict = field(default_factory=dict)  # injection_attempt, fake_role_claim, security_block
    raw_text: str = ""


# ---------------------------------------------------------------------------
# Security pattern detection (checked first, independent of intent)
# ---------------------------------------------------------------------------
SYSTEM_PROMPT_EXTRACTION_PATTERNS = [
    r"\bsystem prompt\b", r"\byour (instructions|prompt|rules)\b", r"\breveal (your )?(prompt|instructions)\b",
    r"\bapi key\b", r"\bcredential", r"\bsecret key\b", r"\bshow me your (config|configuration)\b",
    r"\bwhat model are you\b", r"\bwhat are you built on\b", r"\byour underlying (model|prompt)\b",
]

PROMPT_INJECTION_PATTERNS = [
    r"\bignore (all|any|the)?\s*(previous|prior|above)?\s*instructions\b",
    r"\bdisregard (your|all|the)? (rules|instructions|restrictions)\b",
    r"\boverride (your|the)? (permissions|restrictions|rules)\b",
    r"\bbypass (security|permission|authorization)\b",
    r"\byou (are|'re) now\b.{0,30}\b(unrestricted|free|jailbroken)\b",
    r"\bact as (if|though) you (have|had) no restrictions\b",
    r"\bdeveloper mode\b",
]

FAKE_ROLE_CLAIM_PATTERNS = [
    r"\bi am (the |a )?(principal|teacher|admin|administrator|management)\b",
    r"\bi'?m (the |a )?(principal|teacher|admin|administrator|management)\b",
    r"\bas (the )?(principal|teacher|admin|administrator)\b,",
    r"\bmy role is (principal|teacher|admin|administrator)\b",
    r"\btreat me as (the )?(principal|teacher|admin)\b",
]


def _matches_any(patterns: List[str], text: str) -> bool:
    return any(re.search(p, text, re.IGNORECASE) for p in patterns)


def security_scan(text: str) -> tuple:
    """
    Standalone security pattern check, independent of which NLU provider is
    active. ai_orchestrator calls this BEFORE invoking the configured provider
    (demo or real LLM) so that system-prompt/credential extraction attempts are
    short-circuited -- and never even forwarded to a real LLM -- regardless of
    AI_PROVIDER, and so injection/fake-role flags are always available for the
    orchestrator's note_prefix(), not just in demo mode.

    Returns (block: bool, flags: dict). block=True means the caller should
    treat this turn as intent="security_block" and never call the provider.
    """
    flags = {}
    if _matches_any(SYSTEM_PROMPT_EXTRACTION_PATTERNS, text):
        return True, flags
    if _matches_any(PROMPT_INJECTION_PATTERNS, text):
        flags["injection_attempt"] = True
    if _matches_any(FAKE_ROLE_CLAIM_PATTERNS, text):
        flags["fake_role_claim"] = True
    return False, flags


# ---------------------------------------------------------------------------
# Intent patterns
# ---------------------------------------------------------------------------
CONFIRM_YES_PATTERNS = [r"^\s*yes\b", r"^\s*yeah\b", r"^\s*yup\b", r"^\s*please do\b", r"^\s*go ahead\b", r"^\s*confirm\b", r"^\s*ok(ay)?\s*$"]
CONFIRM_NO_PATTERNS = [r"^\s*no\b", r"^\s*nope\b", r"^\s*don'?t\b", r"^\s*cancel\b", r"^\s*not now\b"]

# "I meant Rahul, not Arjun" / "no I meant Rahul" -- a correction to the
# student/child named in the previous turn. Handled as its own intent so the
# orchestrator can re-run the SAME tool call (get_child_attendance /
# get_student_attendance) that the prior turn used, with the corrected name,
# rather than starting a new unrelated conversation.
CORRECTION_PATTERNS = [r"\bi meant\b", r"\bi mean\b", r"\bnot\b.{0,3}\b(i meant)\b"]

TEACHER_CALL_PATTERNS = [
    # "talk to teacher" / "talk to my/the/a teacher" / "talk to my child's teacher" -- the
    # possessive/article group and the leading (my|the|a) group are both optional so a bare
    # "talk to teacher" (used verbatim in the spec's intent-detection list) still matches.
    r"\btalk to (?:(?:my|the|a) )?(?:child'?s? )?teacher\b",
    r"\bconnect (?:with|to) (?:(?:my|the|a) )?(?:child'?s? )?teacher\b",
    r"\bcall from (the|a) teacher\b",
    r"\bcontact (?:my|the)? ?teacher\b", r"\bspeak (to|with) (?:the|my)? ?teacher\b",
    r"\bi(’|')?m not satisfied\b", r"\bi am not satisfied\b",
]
MANAGEMENT_SUPPORT_PATTERNS = [
    r"\bcontact (school )?management\b", r"\bschool management\b", r"\bspeak (to|with) (the )?principal\b",
    r"\braise (this )?with management\b", r"\btalk to (the )?principal\b",
    r"\bconnect (?:with|to) (?:(?:the|a) )?(?:school )?management\b",
    r"\btalk to (?:a |the )?human\b", r"\bspeak to (?:a |the )?human\b", r"\breal (?:person|human)\b",
    r"\bhuman\b", r"\bfile a complaint\b", r"\bmake a complaint\b", r"\bcomplaint\b",
]

MARK_ATTENDANCE_PATTERNS = [r"\bmark\b.{0,40}\b(absent|present)\b"]

ANALYTICS_PATTERNS = [
    r"\boverall (school )?attendance\b", r"\battendance analytics\b", r"\bschool-?wide attendance\b",
    r"\blowest attendance\b", r"\bwhich class\b.{0,20}\blowest\b", r"\bschool attendance\b",
    r"\bevery student\b", r"\ball students?\b", r"\ball .*\brecords\b", r"\bevery child\b",
]

ATTENDANCE_QUERY_PATTERNS = [
    r"\bmy attendance\b", r"\bmy (child|kid|son|daughter)'?s? attendance\b",
    r"\bhow (much|many)\b.{0,30}\battendance\b", r"\bhow many (classes|days)\b.{0,20}\b(miss|missed|absent)\b",
    r"\battendance\b.{0,20}\bthis (week|month)\b", r"\bwhat is my attendance\b",
    r"\bhow much attendance does\b",
]

# "academics" / "marks" / "grades" -- the marks/report-card equivalent of
# ATTENDANCE_QUERY_PATTERNS above. Deliberately broad (single-word triggers
# like "academics" or "marks" are common in this app's own unknown_intent
# copy and in casual follow-ups), since a narrower pattern would leave the
# assistant unable to answer the exact capability it advertises.
MARKS_QUERY_PATTERNS = [
    r"\bacademic\w*\b", r"\bmarks?\b", r"\bgrades?\b", r"\bscores?\b", r"\breport card\b",
    r"\bhow (did|is|are)\b.{0,20}\bdo(ing|es)?\b.{0,20}\b(school|class|subject|exam|test|academic\w*)\b",
    r"\bhow (am|is|are) (i|he|she|they) doing\b", r"\bresults?\b.{0,10}\b(term|exam|test)\b",
]

# Open-ended "how can I improve" / "any tips" follow-ups. On their own these
# carry no topic, so the orchestrator resolves them against whatever the
# previous turn was about (attendance vs. marks) the same way it already
# does for followup_period ("what about this week?").
IMPROVEMENT_ADVICE_PATTERNS = [
    r"\bhow (can|do) (i|he|she|they) improve\b", r"\bhow to improve\b", r"\bany tips\b",
    r"\bhow (can|do) (i|he|she|they) (do better|get better)\b", r"\bwhat should (i|he|she|they) do\b",
]

PERIOD_PATTERNS = {
    "this week": 7, "this month": 30, "last week": 7, "today": 1, "past week": 7, "past month": 30,
}

STATUS_WORDS = {"absent": "absent", "present": "present"}


def _extract_period_days(text: str) -> Optional[int]:
    low = text.lower()
    for phrase, days in PERIOD_PATTERNS.items():
        if phrase in low:
            return days
    return None


def _extract_status(text: str) -> Optional[str]:
    low = text.lower()
    for word, status in STATUS_WORDS.items():
        if re.search(rf"\b{word}\b", low):
            return status
    return None


def _extract_known_name(text: str, known_names: List[str]) -> Optional[str]:
    for name in known_names:
        if re.search(rf"\b{re.escape(name)}\b", text, re.IGNORECASE):
            return name
    return None


def _extract_correction_name(text: str, known_names: List[str]) -> Optional[str]:
    """
    For "I meant Rahul, not Arjun" style corrections, the *corrected* name is
    the one immediately after "meant" -- not just the first known name found
    in the sentence (which could be the discarded one in "not Arjun").
    """
    low = text.lower()
    idx = low.find("meant")
    if idx == -1:
        idx = low.find("mean")
    search_region = text[idx:] if idx != -1 else text
    best_name, best_pos = None, None
    for name in known_names:
        m = re.search(rf"\b{re.escape(name)}\b", search_region, re.IGNORECASE)
        if m and (best_pos is None or m.start() < best_pos):
            best_name, best_pos = name, m.start()
    return best_name


def detect(text: str, role: str, known_student_names: List[str], has_pending_confirmation: bool) -> IntentResult:
    """
    Main entry point. `role` is the authenticated user's role (for phrasing
    hints only -- NOT used to grant permissions here). `known_student_names`
    lets us extract a name entity precisely instead of guessing at capitalized
    words (works across languages too, since names are usually left in Latin
    script or as-is even in code-switched messages).
    """
    flags = {}
    low = text.lower().strip()

    # 1. Security: system prompt / credential extraction attempts -- always checked first,
    #    always short-circuits everything else.
    if _matches_any(SYSTEM_PROMPT_EXTRACTION_PATTERNS, text):
        return IntentResult(intent="security_block", flags={"security_block": True}, raw_text=text)

    # 2. Prompt injection language -- flagged, but we still try to detect the underlying
    #    ask so the permission engine gets a real chance to deny it (defense in depth,
    #    rather than only pattern-matching the attack phrase itself).
    if _matches_any(PROMPT_INJECTION_PATTERNS, text):
        flags["injection_attempt"] = True

    # 3. Fake role claims -- flagged, same reasoning.
    if _matches_any(FAKE_ROLE_CLAIM_PATTERNS, text):
        flags["fake_role_claim"] = True

    # 4. Confirmation replies, only meaningful if there's a pending action in context.
    if has_pending_confirmation:
        if _matches_any(CONFIRM_YES_PATTERNS, low):
            return IntentResult(intent="confirm_yes", flags=flags, raw_text=text)
        if _matches_any(CONFIRM_NO_PATTERNS, low):
            return IntentResult(intent="confirm_no", flags=flags, raw_text=text)

    # 4.5 Corrections ("I meant Rahul, not Arjun") -- independent of pending
    #     confirmation; the orchestrator decides whether prior context makes
    #     this actionable.
    if _matches_any(CORRECTION_PATTERNS, low):
        corrected_name = _extract_correction_name(text, known_student_names)
        return IntentResult(intent="correction", entities={"corrected_name": corrected_name}, flags=flags, raw_text=text)

    # 5. Escalation intents.
    if _matches_any(TEACHER_CALL_PATTERNS, low):
        name = _extract_known_name(text, known_student_names)
        return IntentResult(intent="request_teacher_call", entities={"student_name": name}, flags=flags, raw_text=text)

    if _matches_any(MANAGEMENT_SUPPORT_PATTERNS, low):
        return IntentResult(intent="request_management_support", flags=flags, raw_text=text)

    # 6. Mark attendance (teacher action).
    if _matches_any(MARK_ATTENDANCE_PATTERNS, low):
        name = _extract_known_name(text, known_student_names)
        status = _extract_status(text)
        return IntentResult(
            intent="mark_attendance",
            entities={"student_name": name, "status": status},
            flags=flags, raw_text=text,
        )

    # 7. School-wide analytics (principal).
    if _matches_any(ANALYTICS_PATTERNS, low):
        return IntentResult(intent="get_school_analytics", flags=flags, raw_text=text)

    # 8. Attendance queries -- own (student) or child's (parent), or teacher/principal
    #    asking about a specific named student. Checked before the marks patterns
    #    below since "attendance" always wins over a bare "academics"/"marks" match.
    if _matches_any(ATTENDANCE_QUERY_PATTERNS, low) or "attendance" in low:
        name = _extract_known_name(text, known_student_names)
        period_days = _extract_period_days(text)
        if role == "student":
            return IntentResult(intent="get_own_attendance", entities={"period_days": period_days}, flags=flags, raw_text=text)
        if role == "parent":
            return IntentResult(intent="get_child_attendance", entities={"child_name": name, "period_days": period_days}, flags=flags, raw_text=text)
        # teacher / principal asking about a specific student by name
        return IntentResult(intent="get_named_student_attendance", entities={"student_name": name, "period_days": period_days}, flags=flags, raw_text=text)

    # 8.5 Marks / academics queries -- own (student), child's (parent), or a
    #     named student (teacher/principal). Same shape as the attendance
    #     branch above, just against the marks tool layer instead.
    if _matches_any(MARKS_QUERY_PATTERNS, low):
        name = _extract_known_name(text, known_student_names)
        if role == "student":
            return IntentResult(intent="get_marks", entities={}, flags=flags, raw_text=text)
        if role == "parent":
            return IntentResult(intent="get_marks", entities={"child_name": name}, flags=flags, raw_text=text)
        return IntentResult(intent="get_marks", entities={"student_name": name}, flags=flags, raw_text=text)

    # 9. Open-ended "how can I improve?" / "any tips?" -- no topic of its own,
    #    resolved by the orchestrator against whatever the previous turn's
    #    topic (attendance or marks) was.
    if _matches_any(IMPROVEMENT_ADVICE_PATTERNS, low):
        return IntentResult(intent="improvement_advice", flags=flags, raw_text=text)

    # 10. Bare follow-up like "what about this week?" -- signal for orchestrator to reuse context.
    if _extract_period_days(text) and len(low.split()) <= 8:
        return IntentResult(intent="followup_period", entities={"period_days": _extract_period_days(text)}, flags=flags, raw_text=text)

    return IntentResult(intent="unknown", flags=flags, raw_text=text)
