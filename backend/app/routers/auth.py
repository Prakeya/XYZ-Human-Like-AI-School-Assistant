from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..auth import verify_password, create_access_token
from ..deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=schemas.LoginResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        # Deliberately generic message -- do not reveal whether the username exists.
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password.")

    token = create_access_token(user.id, user.username, user.role.value)
    return schemas.LoginResponse(
        access_token=token,
        user=schemas.UserPublic(id=user.id, username=user.username, full_name=user.full_name, role=user.role.value),
    )


@router.get("/me", response_model=schemas.UserPublic)
def me(current_user: models.User = Depends(get_current_user)):
    return schemas.UserPublic(
        id=current_user.id, username=current_user.username,
        full_name=current_user.full_name, role=current_user.role.value,
    )
