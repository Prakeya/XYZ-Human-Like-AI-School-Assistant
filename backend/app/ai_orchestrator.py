# -*- coding: utf-8 -*-
"""
AI Orchestrator (spec section 17):

  LLM/NLU -> structured intent -> backend validation -> authorization
           -> tool execution -> result -> natural response

This is the single place that wires together:
  - ai_provider.py       (intent detection, demo or real LLM)
  - permissions.py/tools.py (the ONLY source of truth for what's allowed)
  - translations.py      (role-appropriate, multilingual natural language output)
  - conversation memory  (persisted in Message.meta_json, replayed each turn)

Conversation memory design: rather than an in-memory session (which would be
lost on restart and wouldn't demonstrate real persistence), context is
reconstructed each turn by reading the *previous assistant message's*
meta_json for this conversation -- specifically `pending_action` (for
escalation confirmations) and `context` (last topic/student, for follow-ups
like "what about this week?"). This keeps every turn independently
inspectable in the database, which is also what powers the "trace" shown in
the UI for judge demos.
"""
import json
from typing import Optional
from sqlalchemy.orm import Session

from . import models, tools, translations
from .ai_provider import get_provider
from .intent_engine import IntentResult, security_scan
from .permissions import (
    PermissionDenied, ClarificationNeeded,
    can_create_teacher_call_request, can_create_management_support_request,
)


def _get_or_create_conversation(db: Session, user: models.User, conversation_id: Optional[int]) -> models.Conversation:
    if conversation_id:
        convo = db.query(models.Conversation).filter(
            models.Conversation.id == conversation_id, models.Conversation.user_id == user.id
        ).first()
        if convo:
            return convo
    convo = models.Conversation(user_id=user.id)
    db.add(convo)
    db.flush()
    return convo


def _load_context(db: Session, convo: models.Conversation) -> dict:
    """Reconstruct pending_action + last topic context from the last assistant message."""
    last_assistant = (
        db.query(models.Message)
        .filter(models.Message.conversation_id == convo.id, models.Message.sender == "assistant")
        .order_by(models.Message.id.desc())
        .first()
    )
    if not last_assistant or not last_assistant.meta_json:
        return {}
    try:
        return json.loads(last_assistant.meta_json)
    except (json.JSONDecodeError, TypeError):
        return {}


def _known_student_names(db: Session) -> list:
    return [s.name for s in db.query(models.Student).all()]


def _period_note(period_days: Optional[int]) -> str:
    if not period_days:
        return ""
    if period_days <= 1:
        return " for today"
    if period_days <= 7:
        return " over the last week"
    if period_days <= 31:
        return " over the last month"
    return f" over the last {period_days} days"


def _marks_summary_sentence(marks: list) -> str:
    """Turn the marks tool's list of {subject, score, max_score, percentage}
    dicts into a short, natural-language rundown for the chat reply -- the
    dashboard already has the full table, so the assistant just needs to
    speak the highlights, not reproduce every row."""
    if not marks:
        return ""
    parts = [f"{m['subject']} {m['score']}/{m['max_score']} ({m['percentage']}%)" for m in marks[:4]]
    return ", ".join(parts)


def _average_percentage(marks: list) -> Optional[float]:
    if not marks:
        return None
    return round(sum(m["percentage"] for m in marks) / len(marks), 1)


def _persist(db: Session, convo_id: int, sender: str, content: str, language: str, meta: dict) -> models.Message:
    msg = models.Message(
        conversation_id=convo_id, sender=sender, content=content, language=language,
        meta_json=json.dumps(meta, default=str),
    )
    db.add(msg)
    db.flush()
    return msg


def handle_message(db: Session, user: models.User, text: str, language: str,
                    conversation_id: Optional[int]) -> dict:
    """
    Returns {"conversation_id": int, "reply": str, "language": str, "trace": [...]}
    """
    convo = _get_or_create_conversation(db, user, conversation_id)
    prior_context = _load_context(db, convo)
    pending_action = prior_context.get("pending_action")

    _persist(db, convo.id, "user", text, language, meta={})

    known_names = _known_student_names(db)

    # Security pattern check runs BEFORE the configured provider is invoked at
    # all, regardless of whether that provider is the deterministic demo NLU
    # or a real LLM (ai_provider.AnthropicNLUProvider). This closes the gap
    # where a real-LLM deployment would otherwise skip pattern-based system
    # prompt / credential extraction detection entirely (the LLM's own
    # tool-calling response is NOT trusted to self-police this) -- a
    # "security_block" text is never even sent to an external API.
    security_block, security_flags = security_scan(text)
    if security_block:
        result = IntentResult(intent="security_block", flags={"security_block": True}, raw_text=text)
    else:
        provider = get_provider()
        result = provider.extract(text, user.role.value, known_names, has_pending_confirmation=bool(pending_action))
        # Merge in injection/fake-role flags even when a real LLM provider
        # (which does its own tool-call extraction, not pattern matching)
        # produced the intent -- the note_prefix() disclosure below must not
        # depend on which provider is configured.
        result.flags = {**security_flags, **result.flags}

    trace = [{"step": "intent_detected", "intent": result.intent, "entities": result.entities, "flags": result.flags}]

    reply_text = ""
    new_pending_action = None
    new_topic_context = prior_context.get("context", {})
    permission_denied = False

    def note_prefix() -> str:
        prefix = ""
        if result.flags.get("fake_role_claim"):
            prefix += translations.render("fake_role_notice", language)
        elif result.flags.get("injection_attempt"):
            prefix += translations.render("injection_notice", language)
        return prefix

    try:
        if result.intent == "security_block":
            reply_text = translations.render("security_block_system_prompt", language)
            trace.append({"step": "security_block", "reason": "system prompt / credential extraction attempt"})

        elif result.intent == "confirm_yes" and pending_action:
            action = pending_action
            if action["type"] == "teacher_call":
                tool_result = tools.create_teacher_call_request(
                    db, user, student_name=action.get("student_name"), message=action.get("message")
                )
                trace.append({"step": "tool_call", "tool": "create_teacher_call_request", "result": tool_result})
                reply_text = translations.render("escalation_confirmed_teacher", language)
            elif action["type"] == "management_support":
                tool_result = tools.create_management_support_request(db, user, message=action.get("message"))
                trace.append({"step": "tool_call", "tool": "create_management_support_request", "result": tool_result})
                reply_text = translations.render("escalation_confirmed_management", language)
            new_pending_action = None

        elif result.intent == "confirm_no" and pending_action:
            reply_text = translations.render("escalation_cancelled", language)
            new_pending_action = None

        elif result.intent == "request_teacher_call":
            perm = can_create_teacher_call_request(user)
            trace.append({"step": "permission_check", "allowed": perm.allowed, "reason": perm.reason, "reason_key": perm.reason_key})
            if not perm.allowed:
                permission_denied = True
                localized_reason = translations.reason_text(perm.reason_key, language, fallback=perm.reason)
                reply_text = note_prefix() + translations.render("permission_denied", language, reason=localized_reason)
            else:
                reply_text = note_prefix() + translations.render("escalation_ask_teacher", language)
                new_pending_action = {"type": "teacher_call", "student_name": result.entities.get("student_name")}

        elif result.intent == "request_management_support":
            perm = can_create_management_support_request(user)
            trace.append({"step": "permission_check", "allowed": perm.allowed, "reason": perm.reason, "reason_key": perm.reason_key})
            if not perm.allowed:
                permission_denied = True
                localized_reason = translations.reason_text(perm.reason_key, language, fallback=perm.reason)
                reply_text = note_prefix() + translations.render("permission_denied", language, reason=localized_reason)
            else:
                reply_text = note_prefix() + translations.render("escalation_ask_management", language)
                new_pending_action = {"type": "management_support"}

        elif result.intent == "mark_attendance":
            student_name = result.entities.get("student_name")
            status = result.entities.get("status")
            if not student_name or not status:
                reply_text = translations.render("mark_attendance_need_info", language)
            else:
                tool_result = tools.mark_attendance(db, user, student_name=student_name, status=status)
                trace.append({"step": "tool_call", "tool": "mark_attendance", "result": tool_result})
                reply_text = translations.render(
                    "mark_attendance_confirm", language,
                    student=tool_result["student_name"], status=tool_result["status"], date=tool_result["date"],
                )

        elif result.intent == "get_school_analytics":
            tool_result = tools.get_school_attendance_analytics(db, user)
            trace.append({"step": "tool_call", "tool": "get_school_attendance_analytics", "result": tool_result})
            reply_text = note_prefix() + translations.render(
                "analytics_summary", language,
                overall=tool_result["overall_attendance_percentage"],
                lowest_class=tool_result["lowest_attendance_class"],
            )
            new_topic_context = {"topic": "analytics"}

        elif result.intent == "get_own_attendance":
            period_days = result.entities.get("period_days")
            tool_result = tools.get_student_attendance(db, user, period_days=period_days)
            trace.append({"step": "tool_call", "tool": "get_student_attendance", "result": tool_result})
            reply_text = translations.render(
                "own_attendance", language,
                pct=tool_result["attendance_percentage"], considered=tool_result["days_considered"],
                absent=tool_result["days_absent"], period_note=_period_note(period_days),
            )
            new_topic_context = {"topic": "own_attendance"}

        elif result.intent == "get_child_attendance":
            child_name = result.entities.get("child_name")
            period_days = result.entities.get("period_days")
            tool_result = tools.get_child_attendance(db, user, child_name=child_name, period_days=period_days)
            trace.append({"step": "tool_call", "tool": "get_child_attendance", "result": tool_result})
            reply_text = translations.render(
                "child_attendance", language,
                child=tool_result["student_name"], pct=tool_result["attendance_percentage"],
                considered=tool_result["days_considered"], absent=tool_result["days_absent"],
                period_note=_period_note(period_days),
            )
            new_topic_context = {"topic": "child_attendance", "student_name": tool_result["student_name"]}

        elif result.intent == "get_named_student_attendance":
            student_name = result.entities.get("student_name")
            period_days = result.entities.get("period_days")
            if not student_name:
                reply_text = translations.reason_text("need_student_name", language, fallback="Which student would you like attendance for?")
            else:
                tool_result = tools.get_student_attendance(db, user, student_name=student_name, period_days=period_days)
                trace.append({"step": "tool_call", "tool": "get_student_attendance", "result": tool_result})
                reply_text = note_prefix() + translations.render(
                    "child_attendance", language,
                    child=tool_result["student_name"], pct=tool_result["attendance_percentage"],
                    considered=tool_result["days_considered"], absent=tool_result["days_absent"],
                    period_note=_period_note(period_days),
                )
                new_topic_context = {"topic": "named_student_attendance", "student_name": tool_result["student_name"]}

        elif result.intent == "correction":
            # "I meant Rahul, not Arjun." -- re-run whatever the previous turn's
            # topic was (child/named-student attendance), substituting the
            # corrected name, and update the persisted context to match so a
            # further follow-up ("what about this week?") still resolves to
            # the CORRECTED student, not the original one.
            corrected_name = result.entities.get("corrected_name")
            topic = prior_context.get("context", {}).get("topic")
            if not corrected_name or topic not in ("child_attendance", "named_student_attendance"):
                reply_text = translations.render("unknown_intent", language)
            else:
                if user.role == models.Role.parent:
                    tool_result = tools.get_child_attendance(db, user, child_name=corrected_name)
                else:
                    tool_result = tools.get_student_attendance(db, user, student_name=corrected_name)
                trace.append({"step": "tool_call", "tool": "correction_reresolve", "result": tool_result})
                reply_text = translations.render(
                    "child_attendance", language,
                    child=tool_result["student_name"], pct=tool_result["attendance_percentage"],
                    considered=tool_result["days_considered"], absent=tool_result["days_absent"],
                    period_note="",
                )
                new_topic_context = {"topic": topic, "student_name": tool_result["student_name"]}

        elif result.intent == "followup_period":
            period_days = result.entities.get("period_days")
            topic = prior_context.get("context", {}).get("topic")
            if topic == "own_attendance":
                tool_result = tools.get_student_attendance(db, user, period_days=period_days)
                trace.append({"step": "tool_call", "tool": "get_student_attendance", "result": tool_result})
                reply_text = translations.render(
                    "own_attendance", language,
                    pct=tool_result["attendance_percentage"], considered=tool_result["days_considered"],
                    absent=tool_result["days_absent"], period_note=_period_note(period_days),
                )
            elif topic in ("child_attendance", "named_student_attendance"):
                remembered_name = prior_context.get("context", {}).get("student_name")
                if user.role == models.Role.parent:
                    tool_result = tools.get_child_attendance(db, user, child_name=remembered_name, period_days=period_days)
                else:
                    tool_result = tools.get_student_attendance(db, user, student_name=remembered_name, period_days=period_days)
                trace.append({"step": "tool_call", "tool": "attendance_followup", "result": tool_result})
                reply_text = translations.render(
                    "child_attendance", language,
                    child=tool_result["student_name"], pct=tool_result["attendance_percentage"],
                    considered=tool_result["days_considered"], absent=tool_result["days_absent"],
                    period_note=_period_note(period_days),
                )
                new_topic_context = prior_context.get("context", {})
            else:
                reply_text = translations.render("unknown_intent", language)

        elif result.intent == "get_marks":
            # Same per-role name resolution as attendance: a student always
            # means "me"; a parent's name entity (if any) is looked up only
            # among their own linked children; teacher/principal must name
            # a student. All of that is enforced again inside tools.get_marks
            # / can_view_marks -- this layer only decides which name (if any)
            # to pass through.
            if user.role == models.Role.student:
                tool_result = tools.get_marks(db, user)
            elif user.role == models.Role.parent:
                # "child_name" from the demo intent engine, "student_name" from
                # the LLM tool schema (get_marks only has one param) -- accept either.
                child_name = result.entities.get("child_name") or result.entities.get("student_name")
                tool_result = tools.get_marks(db, user, student_name=child_name)
            else:
                student_name = result.entities.get("student_name")
                if not student_name:
                    raise PermissionDenied("Please tell me which student's marks you'd like to check.", reason_key="need_student_name")
                tool_result = tools.get_marks(db, user, student_name=student_name)
            trace.append({"step": "tool_call", "tool": "get_marks", "result": tool_result})
            marks = tool_result["marks"]
            if marks:
                reply_text = note_prefix() + translations.render(
                    "marks_summary", language,
                    student=tool_result["student_name"], average=_average_percentage(marks),
                    breakdown=_marks_summary_sentence(marks),
                )
            else:
                reply_text = note_prefix() + translations.render("marks_none_yet", language, student=tool_result["student_name"])
            new_topic_context = {"topic": "marks", "student_name": tool_result["student_name"]}

        elif result.intent == "improvement_advice":
            # No topic of its own -- resolve against whatever the previous
            # turn was about, same pattern as followup_period.
            topic = prior_context.get("context", {}).get("topic")
            if topic == "marks":
                reply_text = translations.render("improvement_advice_marks", language)
            elif topic in ("own_attendance", "child_attendance", "named_student_attendance"):
                reply_text = translations.render("improvement_advice_attendance", language)
            else:
                reply_text = translations.render("improvement_advice_generic", language)
            new_topic_context = prior_context.get("context", {})

        else:  # unknown, or confirm_yes/no with no pending action
            reply_text = note_prefix() + translations.render("unknown_intent", language)

    except ClarificationNeeded as e:
        trace.append({"step": "clarification_needed", "detail": e.message})
        reply_text = translations.render("clarify_which_child", language, names=e.message)

    except PermissionDenied as e:
        permission_denied = True
        trace.append({"step": "permission_denied", "reason": e.message, "reason_key": e.reason_key})
        localized_reason = translations.reason_text(e.reason_key, language, fallback=e.message)
        reply_text = note_prefix() + translations.render("permission_denied", language, reason=localized_reason)

    assistant_meta = {
        "intent": result.intent,
        "entities": result.entities,
        "flags": result.flags,
        "permission_denied": permission_denied,
        "pending_action": new_pending_action,
        "context": new_topic_context,
        "trace": trace,
    }
    _persist(db, convo.id, "assistant", reply_text, language, meta=assistant_meta)
    db.commit()

    return {
        "conversation_id": convo.id, "reply": reply_text, "language": language, "trace": trace,
        "pending_action": new_pending_action,
    }
