"""
Escalation/support-request management endpoints (spec section 6: the Teacher
"Escalations / Complaints" table's Resolve action, and the Principal
"Pending/Resolved Requests" tabs).

Creation of a SupportRequest happens through the chat/confirm flow
(tools.create_teacher_call_request / create_management_support_request) --
this router only covers listing (also available via /dashboard) and resolving,
both permission-checked the same way as every other tool.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, tools
from ..database import get_db
from ..deps import get_current_user
from ..permissions import PermissionDenied

router = APIRouter(prefix="/support", tags=["support"])


@router.get("")
def list_support_requests(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        return tools.list_escalations(db, current_user)
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
