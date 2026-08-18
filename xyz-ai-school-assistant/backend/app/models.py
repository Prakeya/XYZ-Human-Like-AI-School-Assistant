"""
Database models for XYZ AI.

Tables: users, students, parents, teachers, attendance, support_requests, conversations, messages

Relationships:
  User (1) -> (1) Student / Parent / Teacher profile, depending on role
  Parent (1) -> (many) Student   [parent_child link table]
  Teacher (1) -> (many) Student  [via class_name]
  Student (1) -> (many) Attendance
"""
import enum
import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, ForeignKey, DateTime, Enum, Text, Table
)
from sqlalchemy.orm import relationship
from .database import Base


class Role(str, enum.Enum):
    student = "student"
    parent = "parent"
    teacher = "teacher"
    principal = "principal"


# Many-to-many: a parent can have multiple children, a child could (rarely) have multiple
# registered guardians. Modeled explicitly rather than assumed 1:1.
parent_child_link = Table(
    "parent_child_link",
    Base.metadata,
    Column("parent_id", Integer, ForeignKey("parents.id"), primary_key=True),
    Column("student_id", Integer, ForeignKey("students.id"), primary_key=True),
)


class User(Base):
    """
    The single authentication identity. Role is set ONLY here, by the backend,
    at account-creation/seed time. It is never accepted from a chat message or
    client-supplied field at request time -- see permissions.py.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(Enum(Role), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    student_profile = relationship("Student", back_populates="user", uselist=False)
    parent_profile = relationship("Parent", back_populates="user", uselist=False)
    teacher_profile = relationship("Teacher", back_populates="user", uselist=False)


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=True)
    name = Column(String, nullable=False)
    class_name = Column(String, nullable=False)  # e.g. "Grade 8 - A"
    roll_number = Column(String, nullable=False)

    user = relationship("User", back_populates="student_profile")
    attendance_records = relationship("Attendance", back_populates="student")
    parents = relationship("Parent", secondary=parent_child_link, back_populates="children")


class Parent(Base):
    __tablename__ = "parents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    name = Column(String, nullable=False)

    user = relationship("User", back_populates="parent_profile")
    children = relationship("Student", secondary=parent_child_link, back_populates="parents")


class Teacher(Base):
    __tablename__ = "teachers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    name = Column(String, nullable=False)
    # Comma-separated list of class names this teacher is authorized over, e.g. "Grade 8 - A,Grade 9 - B"
    assigned_classes = Column(String, nullable=False, default="")

    user = relationship("User", back_populates="teacher_profile")

    def assigned_class_list(self):
        return [c.strip() for c in self.assigned_classes.split(",") if c.strip()]


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    date = Column(String, nullable=False)  # ISO date "YYYY-MM-DD"
    status = Column(String, nullable=False)  # "present" | "absent"
    marked_by_teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=True)
    marked_at = Column(DateTime, default=datetime.datetime.utcnow)

    student = relationship("Student", back_populates="attendance_records")


class SupportRequest(Base):
    """Backs create_teacher_call_request and create_management_support_request tools."""
    __tablename__ = "support_requests"

    id = Column(Integer, primary_key=True, index=True)
    requested_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    request_type = Column(String, nullable=False)  # "teacher_call" | "management_support"
    related_student_id = Column(Integer, ForeignKey("students.id"), nullable=True)
    message = Column(Text, nullable=True)
    status = Column(String, default="submitted")  # submitted -> acknowledged (mocked)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class Conversation(Base):
    """One conversation/session per user login session, holding ordered messages for context memory."""
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    started_at = Column(DateTime, default=datetime.datetime.utcnow)

    messages = relationship("Message", back_populates="conversation", order_by="Message.id")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    sender = Column(String, nullable=False)  # "user" | "assistant" | "system_tool"
    content = Column(Text, nullable=False)
    language = Column(String, default="en")
    # JSON-encoded record of intent/tool call/permission result, for demo transparency in the UI
    meta_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")
