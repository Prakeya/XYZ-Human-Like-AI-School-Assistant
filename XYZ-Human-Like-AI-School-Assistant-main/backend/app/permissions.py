"""
Permission Engine — the backend/application-layer authorization gate described
in spec section 3 & 17:

    User Authentication -> User Role -> Permission Check -> Tool/API -> Data

This module is deliberately independent of the AI/LLM layer. Every function
here takes the AUTHENTICATED `models.User` object (resolved from a verified
JWT by deps.get_current_user) and re-derives what that user is allowed to do
by querying the database relationships (Parent->Child, Teacher->Class).

Nothing here ever trusts a role, student name, or "I am the principal"-style
claim that arrives inside a chat message or request body. Those are, at most,
*arguments* to a lookup (e.g. "which student is named Rahul") -- the
authorization decision itself is always based on current_user.role and the
DB-verified relationship, never on what the text of the message claims.

If the AI layer is bypassed, tricked, or skipped entirely, calling these
functions directly still enforces the same rules -- that's the point.
"""
from dataclasses import dataclass
from typing import Optional
from sqlalchemy.orm import Session

from . import models


class PermissionDenied(Exception):
    """
    Raised when an authorization check fails. Carries a polite, user-safe
    English message (used for the judge-facing trace and for non-chat
    endpoints like /dashboard that have no `language` to localize against),
    plus a stable `reason_key` that the translations layer maps to the
    correct localized sentence for the chat reply. See translations.reason_text().
    """
    def __init__(self, message: str, reason_key: Optional[str] = None):
        self.message = message
        self.reason_key = reason_key
        super().__init__(message)


class ClarificationNeeded(Exception):
    """
    Raised when the request is legitimate but genuinely ambiguous (e.g. a parent
    with multiple linked children didn't say which one). Distinct from
    PermissionDenied so the orchestrator can phrase it as a question, not a refusal.
    """
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


@dataclass
class PermissionResult:
    allowed: bool
    reason: str
    # Stable identifier for translations.reason_text(). Only meaningful (and only
    # required to be a real, mapped key) when allowed=False -- the "reason" for an
    # ALLOW result (e.g. "own record", "linked child") is an internal trace label,
    # never shown to the user, so it doesn't need a translation key.
    reason_key: Optional[str] = None


def _get_student_by_name(db: Session, name: str) -> Optional[models.Student]:
    return db.query(models.Student).filter(models.Student.name.ilike(name.strip())).first()


def can_view_student_attendance(db: Session, user: models.User, student: models.Student) -> PermissionResult:
    """
    Permission matrix (spec section 3):
      student:   own attendance -> ALLOW, other student -> DENY
      parent:    linked child's attendance -> ALLOW, unrelated student -> DENY
      teacher:   attendance for assigned class students -> ALLOW, others -> DENY
      principal: ALLOW (via analytics/authorized attendance management)
    """
    if student is None:
        return PermissionResult(False, "I couldn't find a student by that name in our records.", reason_key="student_not_found")

    if user.role == models.Role.student:
        if user.student_profile and user.student_profile.id == student.id:
            return PermissionResult(True, "own record")
        return PermissionResult(False, "I can only share your own attendance, not another student's.", reason_key="own_attendance_only")

    if user.role == models.Role.parent:
        parent = user.parent_profile
        if parent and any(child.id == student.id for child in parent.children):
            return PermissionResult(True, "linked child")
        return PermissionResult(False, "I can only provide attendance information for your linked child.", reason_key="parent_linked_child_only")

    if user.role == models.Role.teacher:
        teacher = user.teacher_profile
        if teacher and student.class_name in teacher.assigned_class_list():
            return PermissionResult(True, "assigned class")
        return PermissionResult(
            False,
            "I can only share attendance for students in the classes assigned to you.",
            reason_key="teacher_assigned_class_only",
        )

    if user.role == models.Role.principal:
        return PermissionResult(True, "principal oversight")

    return PermissionResult(False, "You are not authorized to view this information.", reason_key="not_authorized_generic")


def can_mark_attendance(db: Session, user: models.User, student: models.Student) -> PermissionResult:
    if student is None:
        return PermissionResult(False, "I couldn't find a student by that name in our records.", reason_key="student_not_found")

    if user.role != models.Role.teacher:
        return PermissionResult(False, "Only teachers are authorized to mark attendance.", reason_key="teacher_only_mark_attendance")

    teacher = user.teacher_profile
    if teacher and student.class_name in teacher.assigned_class_list():
        return PermissionResult(True, "assigned class")
    return PermissionResult(False, "You can only mark attendance for students in your assigned class.", reason_key="teacher_assigned_class_mark_only")


def can_view_school_analytics(user: models.User) -> PermissionResult:
    if user.role == models.Role.principal:
        return PermissionResult(True, "principal")
    return PermissionResult(False, "School-wide analytics are only available to Principal/Management accounts.", reason_key="principal_only_analytics")


def can_create_teacher_call_request(user: models.User) -> PermissionResult:
    # Students and parents may request a teacher call; teachers/principal don't need to.
    if user.role in (models.Role.parent, models.Role.student):
        return PermissionResult(True, "self-service escalation")
    return PermissionResult(False, "This escalation type is only available to students and parents.", reason_key="escalation_student_parent_only")


def can_create_management_support_request(user: models.User) -> PermissionResult:
    if user.role in (models.Role.parent, models.Role.student, models.Role.teacher):
        return PermissionResult(True, "self-service escalation")
    return PermissionResult(False, "This escalation type is not available for your role.", reason_key="escalation_role_not_available")


def can_view_escalations(user: models.User) -> PermissionResult:
    """Teachers see escalations tied to their own assigned classes; principal sees all."""
    if user.role in (models.Role.teacher, models.Role.principal):
        return PermissionResult(True, "staff oversight")
    return PermissionResult(False, "Escalations/complaints are only visible to teachers and management.", reason_key="escalations_staff_only")


def can_resolve_escalation(db: Session, user: models.User, request: "models.SupportRequest") -> PermissionResult:
    if request is None:
        return PermissionResult(False, "That request could not be found.", reason_key="request_not_found")

    if user.role == models.Role.principal:
        return PermissionResult(True, "principal oversight")

    if user.role == models.Role.teacher:
        if request.forwarded_to_principal_at is not None:
            return PermissionResult(
                False,
                "This has been forwarded to the Principal and can only be resolved by them.",
                reason_key="already_forwarded_principal_only",
            )
        teacher = user.teacher_profile
        # A teacher may resolve a request only if it concerns a student in their
        # own assigned class(es) -- unlinked (management_support with no student)
        # requests are principal-only, since no class ownership can be verified.
        if request.related_student_id and teacher:
            student = db.get(models.Student, request.related_student_id)
            if student and student.class_name in teacher.assigned_class_list():
                return PermissionResult(True, "assigned class")
        return PermissionResult(False, "You can only resolve escalations for students in your assigned class.", reason_key="teacher_assigned_class_resolve_only")

    return PermissionResult(False, "You are not authorized to resolve escalations.", reason_key="not_authorized_generic")


def can_forward_escalation(db: Session, user: models.User, request: "models.SupportRequest") -> PermissionResult:
    """A teacher who finds a complaint hard to resolve themselves can forward it
    up to the Principal -- but only for a request tied to their own assigned
    class, and only once."""
    if request is None:
        return PermissionResult(False, "That request could not be found.", reason_key="request_not_found")

    if user.role != models.Role.teacher:
        return PermissionResult(False, "Only teachers can forward a complaint to the Principal.", reason_key="teacher_only_forward")

    if request.status == "resolved":
        return PermissionResult(False, "This request is already resolved.", reason_key="already_resolved")

    if request.forwarded_to_principal_at is not None:
        return PermissionResult(False, "This has already been forwarded to the Principal.", reason_key="already_forwarded_principal_only")

    teacher = user.teacher_profile
    if request.related_student_id and teacher:
        student = db.get(models.Student, request.related_student_id)
        if student and student.class_name in teacher.assigned_class_list():
            return PermissionResult(True, "assigned class")
    return PermissionResult(False, "You can only forward escalations for students in your assigned class.", reason_key="teacher_assigned_class_resolve_only")


def can_view_marks(db: Session, user: models.User, student: models.Student) -> PermissionResult:
    """Same relationship rules as attendance: own/linked-child/own-class/principal."""
    return can_view_student_attendance(db, user, student)


def can_add_marks(db: Session, user: models.User, student: models.Student) -> PermissionResult:
    if student is None:
        return PermissionResult(False, "I couldn't find a student by that name in our records.", reason_key="student_not_found")
    if user.role != models.Role.teacher:
        return PermissionResult(False, "Only teachers are authorized to enter marks.", reason_key="teacher_only_mark_attendance")
    teacher = user.teacher_profile
    if teacher and student.class_name in teacher.assigned_class_list():
        return PermissionResult(True, "assigned class")
    return PermissionResult(False, "You can only enter marks for students in your assigned class.", reason_key="teacher_assigned_class_mark_only")


def can_message(db: Session, sender: models.User, recipient: models.User, student: Optional[models.Student] = None) -> PermissionResult:
    """
    Who can message whom (spec addition: parent<->teacher and teacher<->principal
    communication):
      parent    <-> teacher of a class their child is enrolled in
      teacher   <-> principal
      principal <-> any teacher
    Never student<->anyone (students use the AI assistant / escalation flow instead),
    and never two accounts with no legitimate relationship (e.g. parent <-> a
    teacher who doesn't teach their child).
    """
    if recipient is None:
        return PermissionResult(False, "That recipient could not be found.", reason_key="request_not_found")

    if sender.role == models.Role.parent and recipient.role == models.Role.teacher:
        parent = sender.parent_profile
        teacher = recipient.teacher_profile
        if parent and teacher:
            child_classes = {c.class_name for c in parent.children}
            if child_classes.intersection(teacher.assigned_class_list()):
                return PermissionResult(True, "parent of student in teacher's class")
        return PermissionResult(False, "You can only message your child's teacher.", reason_key="parent_teacher_relationship_only")

    if sender.role == models.Role.teacher and recipient.role == models.Role.parent:
        return can_message(db, recipient, sender, student)

    if sender.role == models.Role.teacher and recipient.role == models.Role.principal:
        return PermissionResult(True, "teacher to principal")

    if sender.role == models.Role.principal and recipient.role == models.Role.teacher:
        return PermissionResult(True, "principal to teacher")

    return PermissionResult(False, "Messaging is only available between a parent and their child's teacher, or between a teacher and the Principal.", reason_key="messaging_relationship_only")
