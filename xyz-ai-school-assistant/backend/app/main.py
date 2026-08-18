"""
XYZ AI - Human-Like AI School Assistant
Backend entrypoint.

Architecture (see README for full diagram):
  Frontend -> Backend API -> Auth/Role -> AI Orchestrator -> Intent Detection
            -> Permission Engine -> Tool Layer -> Mock School DB
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine, SessionLocal
from . import seed_data
from .routers import auth as auth_router
from .routers import dashboard as dashboard_router
from .routers import chat as chat_router
from .routers import support as support_router

app = FastAPI(
    title="XYZ AI - Human-Like AI School Assistant",
    description="Backend API for the Bharat Academix AI & ML Competition 2026 Round 2 submission.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # local demo only -- restrict in a real deployment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_data.seed(db)
    finally:
        db.close()


@app.get("/health")
def health():
    return {"status": "ok", "service": "xyz-ai-backend"}


app.include_router(auth_router.router)
app.include_router(dashboard_router.router)
app.include_router(chat_router.router)
app.include_router(support_router.router)
