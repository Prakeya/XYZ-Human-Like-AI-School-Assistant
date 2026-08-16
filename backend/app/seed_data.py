"""
Seeds the SQLite database with realistic demo data so the app works immediately
on first run. Idempotent: safe to call on every startup.
"""
import datetime
from sqlalchemy.orm import Session
from . import models
from .auth import hash_password

DEMO_PASSWORD = "demo1234"  # same for every seed account, documented in README


def seed(db: Session):
    if db.query(models.User).count() > 0:
        return  # already seeded

    # ---- Teachers ----
    t_mehta_user = models.User(
        username="teacher.mehta", hashed_password=hash_password(DEMO_PASSWORD),
        full_name="Ms. Kavita Mehta", role=models.Role.teacher,
    )
    t_rao_user = models.User(
        username="teacher.rao", hashed_password=hash_password(DEMO_PASSWORD),
        full_name="Mr. Suresh Rao", role=models.Role.teacher,
    )
    db.add_all([t_mehta_user, t_rao_user])
    db.flush()

    t_mehta = models.Teacher(user_id=t_mehta_user.id, name="Ms. Kavita Mehta", assigned_classes="Grade 8 - A")
    t_rao = models.Teacher(user_id=t_rao_user.id, name="Mr. Suresh Rao", assigned_classes="Grade 9 - B")
    db.add_all([t_mehta, t_rao])
    db.flush()

    # ---- Principal ----
    principal_user = models.User(
        username="principal.nair", hashed_password=hash_password(DEMO_PASSWORD),
        full_name="Dr. Anjali Nair", role=models.Role.principal,
    )
    db.add(principal_user)

    # ---- Students ----
    student_defs = [
        ("Rahul", "Grade 8 - A", "801"),
        ("Ananya", "Grade 8 - A", "802"),
        ("Arjun", "Grade 9 - B", "901"),
        ("Priya", "Grade 9 - B", "902"),
    ]
    students = {}
    for name, class_name, roll in student_defs:
        s_user = models.User(
            username=f"student.{name.lower()}", hashed_password=hash_password(DEMO_PASSWORD),
            full_name=name, role=models.Role.student,
        )
        db.add(s_user)
        db.flush()
        s = models.Student(user_id=s_user.id, name=name, class_name=class_name, roll_number=roll)
        db.add(s)
        db.flush()
        students[name] = s

    # ---- Parents (linked to specific children, per spec section 5) ----
    p_sharma_user = models.User(
        username="parent.sharma", hashed_password=hash_password(DEMO_PASSWORD),
        full_name="Mr. Vikram Sharma", role=models.Role.parent,
    )
    p_iyer_user = models.User(
        username="parent.iyer", hashed_password=hash_password(DEMO_PASSWORD),
        full_name="Mrs. Lakshmi Iyer", role=models.Role.parent,
    )
    db.add_all([p_sharma_user, p_iyer_user])
    db.flush()

    p_sharma = models.Parent(user_id=p_sharma_user.id, name="Mr. Vikram Sharma")
    p_sharma.children.append(students["Rahul"])
    p_iyer = models.Parent(user_id=p_iyer_user.id, name="Mrs. Lakshmi Iyer")
    p_iyer.children.append(students["Arjun"])
    db.add_all([p_sharma, p_iyer])
    db.flush()

    # ---- Attendance: generate the last 20 school days per student ----
    import random
    random.seed(42)
    today = datetime.date.today()
    day = today
    days_added = 0
    while days_added < 20:
        day = day - datetime.timedelta(days=1)
        if day.weekday() >= 5:  # skip weekends
            continue
        for name, s in students.items():
            # give each student a distinct-ish attendance rate for a realistic demo
            base_present_prob = {"Rahul": 0.91, "Ananya": 0.97, "Arjun": 0.78, "Priya": 0.88}[name]
            status = "present" if random.random() < base_present_prob else "absent"
            marker = t_mehta.id if s.class_name == "Grade 8 - A" else t_rao.id
            db.add(models.Attendance(
                student_id=s.id, date=day.isoformat(), status=status, marked_by_teacher_id=marker
            ))
        days_added += 1

    db.commit()
