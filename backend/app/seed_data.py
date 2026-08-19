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
    # Deterministic, not probabilistic: the spec requires Rahul to have EXACTLY
    # 1 absent day out of 20 (95% attendance). A per-day random draw (even with a
    # fixed seed) doesn't guarantee an exact count -- it previously produced 3
    # absent days for Rahul with random.seed(42), which is precisely the bug the
    # spec called out ("must show 1 absent, NOT 3 absent"). Instead, fix the exact
    # absent count per student up front and use a seeded shuffle only to pick
    # *which* of the 20 days are the absent ones, so the total is guaranteed.
    import random
    rng = random.Random(42)
    today = datetime.date.today()
    day = today
    school_days = []
    while len(school_days) < 20:
        day = day - datetime.timedelta(days=1)
        if day.weekday() >= 5:  # skip weekends
            continue
        school_days.append(day)

    # exact absent-day counts out of 20 (present% shown in parens for reference)
    absent_counts = {"Rahul": 1, "Ananya": 1, "Arjun": 4, "Priya": 2}  # 95%, 95%, 80%, 90%

    for name, s in students.items():
        absent_n = absent_counts[name]
        indices = list(range(20))
        rng.shuffle(indices)
        absent_indices = set(indices[:absent_n])
        marker = t_mehta.id if s.class_name == "Grade 8 - A" else t_rao.id
        for i, d in enumerate(school_days):
            status = "absent" if i in absent_indices else "present"
            db.add(models.Attendance(
                student_id=s.id, date=d.isoformat(), status=status, marked_by_teacher_id=marker
            ))

    # ---- Sample marks, so the Student/Parent/Teacher marks views aren't empty on first run ----
    marks_defs = [
        ("Rahul", "Mathematics", "Term 1", 88, 100, t_mehta.id),
        ("Rahul", "Science", "Term 1", 76, 100, t_mehta.id),
        ("Rahul", "English", "Term 1", 91, 100, t_mehta.id),
        ("Ananya", "Mathematics", "Term 1", 95, 100, t_mehta.id),
        ("Ananya", "Science", "Term 1", 89, 100, t_mehta.id),
        ("Arjun", "Mathematics", "Term 1", 64, 100, t_rao.id),
        ("Arjun", "Science", "Term 1", 71, 100, t_rao.id),
        ("Priya", "Mathematics", "Term 1", 82, 100, t_rao.id),
    ]
    for name, subject, term, score, max_score, teacher_id in marks_defs:
        db.add(models.Marks(
            student_id=students[name].id, subject=subject, term=term,
            score=score, max_score=max_score, graded_by_teacher_id=teacher_id,
        ))

    # ---- Sample escalation + a starter message thread, for demo transparency ----
    sample_request = models.SupportRequest(
        requested_by_user_id=p_sharma_user.id, request_type="teacher_call",
        related_student_id=students["Rahul"].id, message=None, status="submitted",
    )
    db.add(sample_request)

    db.add(models.DirectMessage(
        sender_user_id=p_sharma_user.id, recipient_user_id=t_mehta_user.id,
        related_student_id=students["Rahul"].id,
        body="Hi Ms. Mehta, could we talk about Rahul's recent Science scores?",
    ))

    db.commit()
