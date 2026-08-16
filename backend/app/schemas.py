"""Pydantic request/response schemas."""
from typing import Optional, List, Any
from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserPublic"


class UserPublic(BaseModel):
    id: int
    username: str
    full_name: str
    role: str

    class Config:
        from_attributes = True


class ChatRequest(BaseModel):
    message: str
    language: str = "en"
    conversation_id: Optional[int] = None


class ChatResponse(BaseModel):
    conversation_id: int
    reply: str
    language: str
    trace: List[Any] = []  # transparency log: intent detected, tool called, permission result
    # Surfaces the same pending_action already computed/persisted internally by the
    # orchestrator (previously only stored in Message.meta_json), so the frontend can
    # render an explicit Yes/No confirmation UI instead of guessing from reply text.
    # Additive only -- does not change any intent/permission/tool logic.
    pending_action: Optional[dict] = None


class EscalationConfirmRequest(BaseModel):
    conversation_id: int
    request_type: str  # "teacher_call" | "management_support"
    related_student_id: Optional[int] = None
    message: Optional[str] = None


LoginResponse.model_rebuild()
