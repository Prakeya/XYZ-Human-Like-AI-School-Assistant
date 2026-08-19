"""
Direct messaging endpoints (spec addition: parent<->teacher communication,
and teacher<->principal communication/log), separate from the AI chat pipeline.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas, tools
from ..database import get_db
from ..deps import get_current_user
from ..permissions import PermissionDenied

router = APIRouter(prefix="/messages", tags=["messages"])


@router.get("/contacts")
def get_contacts(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"contacts": tools.list_message_contacts(db, current_user)}


@router.get("/{other_user_id}")
def get_thread(
    other_user_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return tools.list_messages(db, current_user, other_user_id)
    except PermissionDenied as e:
        raise HTTPException(status_code=403, detail=e.message)


@router.post("")
def post_message(
    payload: schemas.MessageCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return tools.send_message(
            db, current_user,
            recipient_user_id=payload.recipient_user_id, body=payload.body,
            related_student_id=payload.related_student_id,
        )
    except PermissionDenied as e:
        raise HTTPException(status_code=403, detail=e.message)
