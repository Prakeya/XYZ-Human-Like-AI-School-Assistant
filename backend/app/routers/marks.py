"""
Marks/report-card endpoints (spec addition: "parent should be able to see
marks sheets too", "teacher should be able to enter marks").
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas, tools
from ..database import get_db
from ..deps import get_current_user
from ..permissions import PermissionDenied

router = APIRouter(prefix="/marks", tags=["marks"])


@router.get("")
def get_marks(
    student_name: str | None = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return tools.get_marks(db, current_user, student_name=student_name)
    except PermissionDenied as e:
        raise HTTPException(status_code=403, detail=e.message)


@router.post("")
def add_marks(
    payload: schemas.MarksCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return tools.add_marks(
            db, current_user,
            student_name=payload.student_name, subject=payload.subject, term=payload.term,
            score=payload.score, max_score=payload.max_score,
        )
    except PermissionDenied as e:
        raise HTTPException(status_code=403, detail=e.message)
