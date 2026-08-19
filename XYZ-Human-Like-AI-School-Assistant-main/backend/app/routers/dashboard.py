"""
Role-specific dashboard endpoint (spec section 12). Values come from the same
tool layer used by chat, not arbitrary frontend numbers -- so the dashboard
and the AI assistant can never disagree.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, tools
from ..database import get_db
from ..deps import get_current_user
from ..permissions import PermissionDenied

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("")
def get_dashboard(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        if current_user.role == models.Role.student:
            data = tools.get_student_attendance(db, current_user)
            marks = tools.get_marks(db, current_user)
            data["marks"] = marks["marks"]
            return {"role": "student", "data": data}

        if current_user.role == models.Role.parent:
            parent = current_user.parent_profile
            children_data = []
            for child in parent.children:
                info = tools.get_child_attendance(db, current_user, child_name=child.name)
                info["marks"] = tools.get_marks(db, current_user, student_name=child.name)["marks"]
                children_data.append(info)
            own_escalations = tools.list_own_escalations(db, current_user)
            contacts = tools.list_message_contacts(db, current_user)
            return {
                "role": "parent",
                "data": {
                    "children": children_data,
                    "my_complaints": own_escalations,
                    "contacts": contacts,
                },
            }

        if current_user.role == models.Role.teacher:
            teacher = current_user.teacher_profile
            students = db.query(models.Student).filter(
                models.Student.class_name.in_(teacher.assigned_class_list())
            ).all()
            roster = []
            for s in students:
                info = tools.get_student_attendance(db, current_user, student_name=s.name)
                roster.append(info)
            escalations = tools.list_escalations(db, current_user)
            contacts = tools.list_message_contacts(db, current_user)
            return {
                "role": "teacher",
                "data": {
                    "assigned_classes": teacher.assigned_class_list(),
                    "roster": roster,
                    "escalations": escalations,
                    "contacts": contacts,
                },
            }

        if current_user.role == models.Role.principal:
            analytics = tools.get_school_attendance_analytics(db, current_user)
            escalations = tools.list_escalations(db, current_user)
            teachers = db.query(models.Teacher).all()
            teacher_list = [
                {"name": t.name, "assigned_classes": t.assigned_class_list(), "user_id": t.user_id}
                for t in teachers
            ]
            analytics["teachers"] = teacher_list
            analytics["escalations"] = escalations
            analytics["pending_escalation_count"] = len(escalations["pending"])
            analytics["contacts"] = tools.list_message_contacts(db, current_user)
            return {"role": "principal", "data": analytics}

        raise HTTPException(status_code=403, detail="Unknown role.")
    except PermissionDenied as e:
        raise HTTPException(status_code=403, detail=e.message)


@router.get("/attendance-history")
def get_attendance_history(
    student_name: str | None = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Full (not last-10) attendance history, grouped by month -- backs the
    'view full attendance' drill-down so a stale 'recent days' snapshot can't
    misrepresent an otherwise-present student."""
    try:
        return tools.get_attendance_history(db, current_user, student_name=student_name)
    except PermissionDenied as e:
        raise HTTPException(status_code=403, detail=e.message)
