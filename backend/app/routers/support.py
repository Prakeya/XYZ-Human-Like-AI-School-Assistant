"""
Escalation/support-request management endpoints (spec section 6: the Teacher
"Escalations / Complaints" table's Resolve action, and the Principal
"Pending/Resolved Requests" tabs).

Creation of a SupportRequest usually happens through the chat/confirm flow
(tools.create_teacher_call_request / create_management_support_request), but
POST / below wires the exact same tool functions up for a manual "Raise a
request" form on the Parent/Student dashboard, for people who'd rather fill
in a form than type it to the assistant. Same permission checks either way.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, tools
from ..database import get_db
from ..deps import get_current_user
from ..permissions import PermissionDenied
from ..schemas import SupportRequestCreate

router = APIRouter(prefix="/support", tags=["support"])


@router.get("")
def list_support_requests(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        return tools.list_escalations(db, current_user)
    except PermissionDenied as e:
        raise HTTPException(status_code=403, detail=e.message)


@router.post("")
def create_support_request(
    payload: SupportRequestCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Manual equivalent of the chat "Talk to Teacher" / "Contact School
    Management" confirmation -- same tools, same permission rules, just
    triggered from a form instead of a confirmed chat message."""
    try:
        if payload.request_type == "teacher_call":
            return tools.create_teacher_call_request(
                db, current_user, student_name=payload.student_name, message=payload.message
            )
        if payload.request_type == "management_support":
            return tools.create_management_support_request(db, current_user, message=payload.message)
        raise HTTPException(status_code=400, detail="request_type must be 'teacher_call' or 'management_support'.")
    except PermissionDenied as e:
        raise HTTPException(status_code=403, detail=e.message)


@router.patch("/{request_id}/resolve")
def resolve_support_request(
    request_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    try:
        return tools.resolve_escalation(db, current_user, request_id)
    except PermissionDenied as e:
        raise HTTPException(status_code=403, detail=e.message)


@router.patch("/{request_id}/forward")
def forward_support_request(
    request_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """A teacher forwards a complaint they find hard to resolve up to the Principal."""
    try:
        return tools.forward_escalation_to_principal(db, current_user, request_id)
    except PermissionDenied as e:
        raise HTTPException(status_code=403, detail=e.message)


@router.get("/mine")
def list_own_support_requests(
    current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """A student/parent's view of the complaints/requests THEY raised."""
    try:
        return tools.list_own_escalations(db, current_user)
    except PermissionDenied as e:
        raise HTTPException(status_code=403, detail=e.message)
