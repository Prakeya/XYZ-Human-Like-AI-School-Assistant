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
            return {"role": "student", "data": data}

        if current_user.role == models.Role.parent:
            parent = current_user.parent_profile
            children_data = []
            for child in parent.children:
                children_data.append(tools.get_child_attendance(db, current_user, child_name=child.name))
            return {"role": "parent", "data": {"children": children_data}}

        if current_user.role == models.Role.teacher:
            teacher = current_user.teacher_profile
            students = db.query(models.Student).filter(
                models.Student.class_name.in_(teacher.assigned_class_list())
            ).all()
            roster = []
            for s in students:
                info = tools.get_student_attendance(db, current_user, student_name=s.name)
                roster.append(info)
            return {"role": "teacher", "data": {"assigned_classes": teacher.assigned_class_list(), "roster": roster}}

        if current_user.role == models.Role.principal:
            analytics = tools.get_school_attendance_analytics(db, current_user)
            return {"role": "principal", "data": analytics}

        raise HTTPException(status_code=403, detail="Unknown role.")
    except PermissionDenied as e:
        raise HTTPException(status_code=403, detail=e.message)
