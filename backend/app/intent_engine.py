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


# ---------------------------------------------------------------------------
# Intent patterns
# ---------------------------------------------------------------------------
CONFIRM_YES_PATTERNS = [r"^\s*yes\b", r"^\s*yeah\b", r"^\s*yup\b", r"^\s*please do\b", r"^\s*go ahead\b", r"^\s*confirm\b", r"^\s*ok(ay)?\s*$"]
CONFIRM_NO_PATTERNS = [r"^\s*no\b", r"^\s*nope\b", r"^\s*don'?t\b", r"^\s*cancel\b", r"^\s*not now\b"]

TEACHER_CALL_PATTERNS = [
    r"\btalk to (my|the|a) (child'?s )?teacher\b", r"\bcall from (the|a) teacher\b",
    r"\bcontact (my|the) teacher\b", r"\bspeak (to|with) (the|my) teacher\b",
    r"\bi(’|')?m not satisfied\b", r"\bi am not satisfied\b",
]
MANAGEMENT_SUPPORT_PATTERNS = [
    r"\bcontact (school )?management\b", r"\bschool management\b", r"\bspeak (to|with) (the )?principal\b",
    r"\braise (this )?with management\b", r"\btalk to (the )?principal\b",
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
    #    asking about a specific named student.
    if _matches_any(ATTENDANCE_QUERY_PATTERNS, low) or "attendance" in low:
        name = _extract_known_name(text, known_student_names)
        period_days = _extract_period_days(text)
        if role == "student":
            return IntentResult(intent="get_own_attendance", entities={"period_days": period_days}, flags=flags, raw_text=text)
        if role == "parent":
            return IntentResult(intent="get_child_attendance", entities={"child_name": name, "period_days": period_days}, flags=flags, raw_text=text)
        # teacher / principal asking about a specific student by name
        return IntentResult(intent="get_named_student_attendance", entities={"student_name": name, "period_days": period_days}, flags=flags, raw_text=text)

    # 9. Bare follow-up like "what about this week?" -- signal for orchestrator to reuse context.
    if _extract_period_days(text) and len(low.split()) <= 8:
        return IntentResult(intent="followup_period", entities={"period_days": _extract_period_days(text)}, flags=flags, raw_text=text)

    return IntentResult(intent="unknown", flags=flags, raw_text=text)
