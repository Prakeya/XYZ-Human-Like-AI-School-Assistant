"""
Mock School APIs / Tool Layer (spec section 5 & 17).

Every tool function here:
  1. Accepts the AUTHENTICATED user (never a role string from the request).
  2. Independently re-checks authorization via permissions.py before touching data.
  3. Raises PermissionDenied (never silently returns another user's data) if the
     check fails -- regardless of what the AI orchestrator "intended" to call.
  4. Returns plain dicts (JSON-serializable) so the AI layer can turn them into
     natural language, never raw ORM objects.

This is the layer the spec means by "the AI must actually invoke these tools
instead of inventing results" and "never fake a successful API call."
"""
import datetime
from typing import Optional
from sqlalchemy.orm import Session

from . import models
from .permissions import (
    PermissionDenied, ClarificationNeeded, can_view_student_attendance, can_mark_attendance,
    can_view_school_analytics, can_create_teacher_call_request,
    can_create_management_support_request, can_view_escalations, can_resolve_escalation,
    can_forward_escalation, can_view_marks, can_add_marks, can_message,
    _get_student_by_name,
)


def _attendance_percentage(records: list) -> float:
    if not records:
        return 0.0
    present = sum(1 for r in records if r.status == "present")
    return round(100.0 * present / len(records), 1)


def _serialize_records(records: list, limit: Optional[int] = None) -> list:
    ordered = sorted(records, key=lambda r: r.date, reverse=True)
    if limit:
        ordered = ordered[:limit]
    return [{"date": r.date, "status": r.status} for r in ordered]


def _filter_last_n_days(records: list, days: int) -> list:
    cutoff = (datetime.date.today() - datetime.timedelta(days=days)).isoformat()
    return [r for r in records if r.date >= cutoff]


# ---------------------------------------------------------------------------
# TOOL: get_student_attendance
# For a student asking about THEIR OWN attendance (also reachable by teachers/
# principal who are separately authorized to view a given student).
# ---------------------------------------------------------------------------
def get_student_attendance(db: Session, user: models.User, student_name: Optional[str] = None,
                            period_days: Optional[int] = None) -> dict:
    # A plain student always means "me" -- resolve from their own profile,
    # ignoring any student_name the message text might contain, to close off
    # "as a student, show me Ananya's attendance" style attempts at this layer too.
    if user.role == models.Role.student:
        student = user.student_profile
    else:
        if not student_name:
            raise PermissionDenied(
                "Please tell me which student's attendance you'd like to check.",
                reason_key="need_student_name",
            )
        student = _get_student_by_name(db, student_name)

    result = can_view_student_attendance(db, user, student)
    if not result.allowed:
        raise PermissionDenied(result.reason, reason_key=result.reason_key)

    records = student.attendance_records
    used_records = _filter_last_n_days(records, period_days) if period_days else records

    return {
        "student_name": student.name,
        "class_name": student.class_name,
        "attendance_percentage": _attendance_percentage(used_records),
        "days_considered": len(used_records),
        "days_absent": sum(1 for r in used_records if r.status == "absent"),
        "recent_records": _serialize_records(used_records, limit=10),
        "period": f"last {period_days} days" if period_days else "all recorded days",
    }


# ---------------------------------------------------------------------------
# TOOL: get_child_attendance
# Parent-facing. Resolves "my child" / a named child, but ONLY within that
# parent's own linked children -- verified against the parent_child_link table.
# ---------------------------------------------------------------------------
def get_child_attendance(db: Session, user: models.User, child_name: Optional[str] = None,
                          period_days: Optional[int] = None) -> dict:
    if user.role != models.Role.parent or not user.parent_profile:
        raise PermissionDenied("This tool is only available to parent accounts.", reason_key="parent_account_only")

    parent = user.parent_profile
    if not parent.children:
        raise PermissionDenied("No student is currently linked to your parent account.", reason_key="no_linked_child")

    if child_name:
        student = next((c for c in parent.children if c.name.lower() == child_name.strip().lower()), None)
        if student is None:
            # Important: do NOT reveal whether a student with that name exists at all --
            # just that it isn't authorized for this parent.
            raise PermissionDenied(
                "I can only provide attendance information for your linked child.",
                reason_key="parent_linked_child_only",
            )
    else:
        # "my child" with a single linked child is unambiguous; with multiple, ask.
        if len(parent.children) > 1:
            names = ", ".join(c.name for c in parent.children)
            raise ClarificationNeeded(names)
        student = parent.children[0]

    result = can_view_student_attendance(db, user, student)
    if not result.allowed:
        raise PermissionDenied(result.reason, reason_key=result.reason_key)

    records = student.attendance_records
    used_records = _filter_last_n_days(records, period_days) if period_days else records

    return {
        "student_name": student.name,
        "class_name": student.class_name,
        "attendance_percentage": _attendance_percentage(used_records),
        "days_considered": len(used_records),
        "days_absent": sum(1 for r in used_records if r.status == "absent"),
        "recent_records": _serialize_records(used_records, limit=10),
        "period": f"last {period_days} days" if period_days else "all recorded days",
    }


# ---------------------------------------------------------------------------
# TOOL: mark_attendance
# Teacher-facing. Only for students in that teacher's assigned classes.
# ---------------------------------------------------------------------------
def mark_attendance(db: Session, user: models.User, student_name: str, status: str,
                     date: Optional[str] = None) -> dict:
    if status not in ("present", "absent"):
        raise PermissionDenied("Attendance status must be 'present' or 'absent'.", reason_key="invalid_attendance_status")

    student = _get_student_by_name(db, student_name)
    result = can_mark_attendance(db, user, student)
    if not result.allowed:
        raise PermissionDenied(result.reason, reason_key=result.reason_key)

    target_date = date or datetime.date.today().isoformat()
    teacher = user.teacher_profile

    existing = next((r for r in student.attendance_records if r.date == target_date), None)
    if existing:
        existing.status = status
        existing.marked_by_teacher_id = teacher.id
        existing.marked_at = datetime.datetime.utcnow()
    else:
        db.add(models.Attendance(
            student_id=student.id, date=target_date, status=status,
            marked_by_teacher_id=teacher.id,
        ))
    db.commit()

    return {
        "student_name": student.name,
        "date": target_date,
        "status": status,
        "marked_by": teacher.name,
        "confirmed": True,
    }


# ---------------------------------------------------------------------------
# TOOL: get_school_attendance_analytics
# Principal-facing only.
# ---------------------------------------------------------------------------
def get_school_attendance_analytics(db: Session, user: models.User) -> dict:
    result = can_view_school_analytics(user)
    if not result.allowed:
        raise PermissionDenied(result.reason, reason_key=result.reason_key)

    students = db.query(models.Student).all()
    by_class = {}
    overall_present = 0
    overall_total = 0

    for s in students:
        recs = s.attendance_records
        present = sum(1 for r in recs if r.status == "present")
        total = len(recs)
        overall_present += present
        overall_total += total
        by_class.setdefault(s.class_name, {"present": 0, "total": 0, "students": []})
        by_class[s.class_name]["present"] += present
        by_class[s.class_name]["total"] += total
        by_class[s.class_name]["students"].append({
            "name": s.name,
            "attendance_percentage": _attendance_percentage(recs),
        })

    class_summary = []
    for class_name, agg in by_class.items():
        pct = round(100.0 * agg["present"] / agg["total"], 1) if agg["total"] else 0.0
        class_summary.append({
            "class_name": class_name,
            "attendance_percentage": pct,
            "students": agg["students"],
        })
    class_summary.sort(key=lambda c: c["attendance_percentage"])

    overall_pct = round(100.0 * overall_present / overall_total, 1) if overall_total else 0.0

    return {
        "overall_attendance_percentage": overall_pct,
        "class_summary": class_summary,
        "lowest_attendance_class": class_summary[0]["class_name"] if class_summary else None,
        "total_students": len(students),
        "total_teachers": db.query(models.Teacher).count(),
    }


# ---------------------------------------------------------------------------
# TOOL: create_teacher_call_request
# ---------------------------------------------------------------------------
def create_teacher_call_request(db: Session, user: models.User, student_name: Optional[str] = None,
                                 message: Optional[str] = None) -> dict:
    result = can_create_teacher_call_request(user)
    if not result.allowed:
        raise PermissionDenied(result.reason, reason_key=result.reason_key)

    student = None
    if user.role == models.Role.parent and user.parent_profile:
        if student_name:
            student = next((c for c in user.parent_profile.children if c.name.lower() == student_name.strip().lower()), None)
        elif len(user.parent_profile.children) == 1:
            student = user.parent_profile.children[0]
    elif user.role == models.Role.student:
        student = user.student_profile

    req = models.SupportRequest(
        requested_by_user_id=user.id,
        request_type="teacher_call",
        related_student_id=student.id if student else None,
        message=message,
        status="submitted",
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    return {"request_id": req.id, "status": req.status, "confirmed": True, "type": "teacher_call"}


# ---------------------------------------------------------------------------
# TOOL: create_management_support_request
# ---------------------------------------------------------------------------
def create_management_support_request(db: Session, user: models.User, message: Optional[str] = None) -> dict:
    result = can_create_management_support_request(user)
    if not result.allowed:
        raise PermissionDenied(result.reason, reason_key=result.reason_key)

    req = models.SupportRequest(
        requested_by_user_id=user.id,
        request_type="management_support",
        related_student_id=None,
        message=message,
        status="submitted",
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    return {"request_id": req.id, "status": req.status, "confirmed": True, "type": "management_support"}


# ---------------------------------------------------------------------------
# TOOL: list_escalations / resolve_escalation
# (backs the Teacher "Escalations / Complaints" and Principal "Pending/Resolved
# Requests" dashboard sections -- spec section 6)
# ---------------------------------------------------------------------------
def _serialize_escalation(db: Session, req: "models.SupportRequest") -> dict:
    requester = db.get(models.User, req.requested_by_user_id)
    student = db.get(models.Student, req.related_student_id) if req.related_student_id else None
    return {
        "id": req.id,
        "requester_user_id": requester.id if requester else None,
        "requester_name": requester.full_name if requester else "Unknown",
        "requester_role": requester.role.value if requester else None,
        "student_name": student.name if student else None,
        "request_type": req.request_type,  # "teacher_call" | "management_support"
        "message": req.message,
        "status": req.status,  # "submitted" | "resolved"
        "created_at": req.created_at.isoformat() if req.created_at else None,
        "forwarded_to_principal": req.forwarded_to_principal_at is not None,
        "forwarded_at": req.forwarded_to_principal_at.isoformat() if req.forwarded_to_principal_at else None,
    }


def list_escalations(db: Session, user: models.User) -> dict:
    result = can_view_escalations(user)
    if not result.allowed:
        raise PermissionDenied(result.reason, reason_key=result.reason_key)

    query = db.query(models.SupportRequest)

    if user.role == models.Role.teacher:
        teacher = user.teacher_profile
        class_list = teacher.assigned_class_list() if teacher else []
        student_ids = [
            s.id for s in db.query(models.Student).filter(models.Student.class_name.in_(class_list)).all()
        ]
        # A teacher sees escalations tied to one of their own students, PLUS
        # unlinked management_support requests they personally raised (e.g. a
        # teacher's own "contact management" escalation) -- never other staff's.
        query = query.filter(
            (models.SupportRequest.related_student_id.in_(student_ids))
            | (
                (models.SupportRequest.related_student_id.is_(None))
                & (models.SupportRequest.requested_by_user_id == user.id)
            )
        )
    # principal: no extra filter -- sees everything, per spec.

    requests = query.order_by(models.SupportRequest.created_at.desc()).all()
    serialized = [_serialize_escalation(db, r) for r in requests]

    return {
        "pending": [r for r in serialized if r["status"] == "submitted"],
        "resolved": [r for r in serialized if r["status"] == "resolved"],
    }


def resolve_escalation(db: Session, user: models.User, request_id: int) -> dict:
    req = db.get(models.SupportRequest, request_id)
    result = can_resolve_escalation(db, user, req)
    if not result.allowed:
        raise PermissionDenied(result.reason, reason_key=result.reason_key)

    req.status = "resolved"
    db.commit()
    db.refresh(req)
    return _serialize_escalation(db, req)


def forward_escalation_to_principal(db: Session, user: models.User, request_id: int) -> dict:
    """A teacher forwards a complaint they find hard to resolve up to the Principal."""
    req = db.get(models.SupportRequest, request_id)
    result = can_forward_escalation(db, user, req)
    if not result.allowed:
        raise PermissionDenied(result.reason, reason_key=result.reason_key)

    req.forwarded_to_principal_at = datetime.datetime.utcnow()
    req.forwarded_by_user_id = user.id
    db.commit()
    db.refresh(req)
    return _serialize_escalation(db, req)


def list_own_escalations(db: Session, user: models.User) -> dict:
    """A student/parent's view of the complaints/requests THEY raised, so a
    parent can see whether their complaint is still pending, resolved, or has
    been forwarded to the Principal."""
    if user.role not in (models.Role.student, models.Role.parent):
        raise PermissionDenied("This view is only available to student and parent accounts.", reason_key="not_authorized_generic")

    requests = (
        db.query(models.SupportRequest)
        .filter(models.SupportRequest.requested_by_user_id == user.id)
        .order_by(models.SupportRequest.created_at.desc())
        .all()
    )
    serialized = [_serialize_escalation(db, r) for r in requests]
    return {
        "pending": [r for r in serialized if r["status"] == "submitted"],
        "resolved": [r for r in serialized if r["status"] == "resolved"],
    }


# ---------------------------------------------------------------------------
# TOOL: get_attendance_history
# Full (not last-10) attendance record for a student, grouped by month, so a
# single stale "recent days" snapshot can't make an otherwise-present student
# look chronically absent. Same relationship rules as get_student_attendance.
# ---------------------------------------------------------------------------
def get_attendance_history(db: Session, user: models.User, student_name: Optional[str] = None) -> dict:
    if user.role == models.Role.student:
        student = user.student_profile
    else:
        if not student_name:
            raise PermissionDenied("Please tell me which student's attendance you'd like to check.", reason_key="need_student_name")
        student = _get_student_by_name(db, student_name)

    result = can_view_student_attendance(db, user, student)
    if not result.allowed:
        raise PermissionDenied(result.reason, reason_key=result.reason_key)

    records = sorted(student.attendance_records, key=lambda r: r.date, reverse=True)
    by_month = {}
    for r in records:
        month_key = r.date[:7]  # "YYYY-MM"
        by_month.setdefault(month_key, []).append({"date": r.date, "status": r.status})

    months = []
    for month_key, recs in sorted(by_month.items(), reverse=True):
        present = sum(1 for r in recs if r["status"] == "present")
        months.append({
            "month": month_key,
            "records": recs,
            "days_considered": len(recs),
            "days_absent": len(recs) - present,
            "attendance_percentage": round(100.0 * present / len(recs), 1) if recs else 0.0,
        })

    return {
        "student_name": student.name,
        "class_name": student.class_name,
        "attendance_percentage": _attendance_percentage(records),
        "days_considered": len(records),
        "days_absent": sum(1 for r in records if r.status == "absent"),
        "months": months,
    }


# ---------------------------------------------------------------------------
# TOOL: get_marks / add_marks
# ---------------------------------------------------------------------------
def _serialize_marks(m: "models.Marks") -> dict:
    return {
        "id": m.id,
        "subject": m.subject,
        "term": m.term,
        "score": m.score,
        "max_score": m.max_score,
        "percentage": round(100.0 * m.score / m.max_score, 1) if m.max_score else 0.0,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


def get_marks(db: Session, user: models.User, student_name: Optional[str] = None) -> dict:
    if user.role == models.Role.student:
        student = user.student_profile
    else:
        if not student_name:
            raise PermissionDenied("Please tell me which student's marks you'd like to check.", reason_key="need_student_name")
        student = _get_student_by_name(db, student_name)

    result = can_view_marks(db, user, student)
    if not result.allowed:
        raise PermissionDenied(result.reason, reason_key=result.reason_key)

    records = (
        db.query(models.Marks)
        .filter(models.Marks.student_id == student.id)
        .order_by(models.Marks.created_at.desc())
        .all()
    )
    return {
        "student_name": student.name,
        "class_name": student.class_name,
        "marks": [_serialize_marks(m) for m in records],
    }


def add_marks(db: Session, user: models.User, student_name: str, subject: str, term: str,
              score: float, max_score: float = 100.0) -> dict:
    student = _get_student_by_name(db, student_name)
    result = can_add_marks(db, user, student)
    if not result.allowed:
        raise PermissionDenied(result.reason, reason_key=result.reason_key)

    if score < 0 or max_score <= 0 or score > max_score:
        raise PermissionDenied("Score must be between 0 and the maximum score.", reason_key="invalid_marks_score")

    teacher = user.teacher_profile
    record = models.Marks(
        student_id=student.id, subject=subject.strip(), term=term.strip(),
        score=score, max_score=max_score, graded_by_teacher_id=teacher.id if teacher else None,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _serialize_marks(record)


# ---------------------------------------------------------------------------
# TOOL: messaging (parent<->teacher, teacher<->principal)
# ---------------------------------------------------------------------------
def _serialize_message(m: "models.DirectMessage") -> dict:
    return {
        "id": m.id,
        "sender_user_id": m.sender_user_id,
        "recipient_user_id": m.recipient_user_id,
        "related_student_id": m.related_student_id,
        "body": m.body,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


def list_message_contacts(db: Session, user: models.User) -> list:
    """Who this user is allowed to message, per can_message's relationship rules."""
    contacts = []

    if user.role == models.Role.parent and user.parent_profile:
        class_names = {c.class_name for c in user.parent_profile.children}
        teachers = db.query(models.Teacher).all()
        for t in teachers:
            if class_names.intersection(t.assigned_class_list()):
                contacts.append({"user_id": t.user_id, "name": t.name, "role": "teacher"})

    elif user.role == models.Role.teacher and user.teacher_profile:
        class_names = set(user.teacher_profile.assigned_class_list())
        parents = db.query(models.Parent).all()
        for p in parents:
            if any(c.class_name in class_names for c in p.children):
                contacts.append({"user_id": p.user_id, "name": p.name, "role": "parent"})
        principal = db.query(models.User).filter(models.User.role == models.Role.principal).first()
        if principal:
            contacts.append({"user_id": principal.id, "name": principal.full_name, "role": "principal"})

    elif user.role == models.Role.principal:
        teachers = db.query(models.Teacher).all()
        for t in teachers:
            contacts.append({"user_id": t.user_id, "name": t.name, "role": "teacher"})

    return contacts


def list_messages(db: Session, user: models.User, other_user_id: int) -> dict:
    other = db.get(models.User, other_user_id)
    result = can_message(db, user, other)
    if not result.allowed:
        raise PermissionDenied(result.reason, reason_key=result.reason_key)

    thread = (
        db.query(models.DirectMessage)
        .filter(
            ((models.DirectMessage.sender_user_id == user.id) & (models.DirectMessage.recipient_user_id == other.id))
            | ((models.DirectMessage.sender_user_id == other.id) & (models.DirectMessage.recipient_user_id == user.id))
        )
        .order_by(models.DirectMessage.created_at.asc())
        .all()
    )
    return {
        "other_user_id": other.id,
        "other_name": other.full_name,
        "messages": [_serialize_message(m) for m in thread],
    }


def send_message(db: Session, user: models.User, recipient_user_id: int, body: str,
                  related_student_id: Optional[int] = None) -> dict:
    if not body or not body.strip():
        raise PermissionDenied("Message cannot be empty.", reason_key="empty_message")

    recipient = db.get(models.User, recipient_user_id)
    result = can_message(db, user, recipient)
    if not result.allowed:
        raise PermissionDenied(result.reason, reason_key=result.reason_key)

    msg = models.DirectMessage(
        sender_user_id=user.id, recipient_user_id=recipient_user_id,
        related_student_id=related_student_id, body=body.strip(),
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return _serialize_message(msg)
