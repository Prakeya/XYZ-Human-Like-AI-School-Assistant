from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user
from ..ai_orchestrator import handle_message

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=schemas.ChatResponse)
def chat(payload: schemas.ChatRequest, current_user: models.User = Depends(get_current_user),
         db: Session = Depends(get_db)):
    result = handle_message(
        db=db, user=current_user, text=payload.message,
        language=payload.language, conversation_id=payload.conversation_id,
    )
    return schemas.ChatResponse(**result)


@router.get("/history/{conversation_id}")
def history(conversation_id: int, current_user: models.User = Depends(get_current_user),
            db: Session = Depends(get_db)):
    convo = db.query(models.Conversation).filter(
        models.Conversation.id == conversation_id, models.Conversation.user_id == current_user.id
    ).first()
    if not convo:
        return {"messages": []}
    return {
        "messages": [
            {"sender": m.sender, "content": m.content, "language": m.language, "created_at": m.created_at}
            for m in convo.messages
        ]
    }
