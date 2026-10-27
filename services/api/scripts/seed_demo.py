
from datetime import UTC, datetime, timedelta

from sqlmodel import Session, select

from app.db import engine
from app.models import ExercisePlan, Patient, ReviewItem, SessionRecord


def utc_now_naive() -> datetime:
    """Return UTC time as a naive datetime for MySQL DATETIME."""
    return datetime.now(UTC).replace(tzinfo=None)


def seed_demo_data() -> None:
    """Insert demo records only into an entirely empty database."""
    with Session(engine) as session:
        # Safety guard: never mix demo seeding with existing records.
        models = (Patient, ExercisePlan, SessionRecord, ReviewItem)
        counts = {
            model.__tablename__: len(session.exec(select(model)).all())
            for model in models
        }

        if any(counts.values()):
            raise RuntimeError(
                "Seed aborted: at least one table is not empty. "
                f"Current row counts: {counts}"
            )

        now = utc_now_naive()
        patients = [
            Patient(
                display_name="Demo Patient A",
                pathway="Knee rehabilitation",
                recovery_start=(now - timedelta(days=20)).date(),
                clinician_name="Demo Clinician",
                consent_status="synthetic",
                is_synthetic=True,
            ),
            Patient(
                display_name="Demo Patient B",
                pathway="Shoulder rehabilitation",
                recovery_start=(now - timedelta(days=15)).date(),
                clinician_name="Demo Clinician",
                consent_status="synthetic",
                is_synthetic=True,
            ),
            Patient(
                display_name="Demo Patient C",
                pathway="Knee rehabilitation",
                recovery_start=(now - timedelta(days=12)).date(),
                clinician_name="Demo Clinician",
                consent_status="synthetic",
                is_synthetic=True,
            ),
        ]
        session.add_all(patients)
        session.flush()

        plans = [
            ExercisePlan(
                patient_id=patients[0].id,
                name="Knee flexion practice",
                target_repetitions=10,
                sessions_per_day=2,
                start_max=60,
                target_min=90,
                instructions="Synthetic demo plan. Follow clinician-approved guidance.",
            ),
            ExercisePlan(
                patient_id=patients[1].id,
                name="Shoulder range-of-motion practice",
                target_repetitions=8,
                sessions_per_day=2,
                start_max=45,
                target_min=75,
                instructions="Synthetic demo plan. Follow clinician-approved guidance.",
            ),
            ExercisePlan(
                patient_id=patients[2].id,
                name="Knee range-of-motion practice",
                target_repetitions=10,
                sessions_per_day=1,
                start_max=50,
                target_min=85,
                instructions="Synthetic demo plan. Follow clinician-approved guidance.",
            ),
        ]
        session.add_all(plans)
        session.flush()

        # Day offsets are relative to the current time, so the data stays recent.
        # Each tuple: patient index, day offset, repetitions, max angle,
        # min angle, tracking quality, visibility ratio, reported pain.
        session_specs = [
            (0, 9, 6, 62, 12, "good", 0.98, 2),
            (1, 9, 8, 48, 10, "good", 0.95, 1),
            (2, 8, 9, 54, 11, "good", 0.96, 2),
            (0, 7, 8, 68, 10, "good", 0.97, 2),
            (1, 6, 7, 52, 9, "fair", 0.82, 2),
            (0, 5, 8, 70, 10, "good", 0.97, 2),
            (0, 3, 9, 78, 9, "good", 0.99, 5),
            (1, 2, 5, 50, 12, "poor", 0.48, 2),
            (2, 1, 8, 66, 8, "good", 0.96, 2),
            (0, 0, 10, 82, 8, "good", 0.98, 3),
        ]

        records = []
        for patient_index, days_ago, reps, max_angle, min_angle, quality, visibility, pain in session_specs:
            started_at = (now - timedelta(days=days_ago)).replace(
                hour=10,
                minute=0,
                second=0,
                microsecond=0,
            )
            # Keep today's example session safely in the past.
            if started_at >= now:
                started_at = now - timedelta(minutes=5)

            records.append(
                SessionRecord(
                    patient_id=patients[patient_index].id,
                    exercise_id=plans[patient_index].id,
                    started_at=started_at,
                    duration_sec=240 + reps * 12,
                    repetition_count=reps,
                    max_angle=max_angle,
                    min_angle=min_angle,
                    tracking_quality=quality,
                    visibility_ratio=visibility,
                    patient_reported_pain=pain,
                    completion_status="completed" if reps >= 8 else "partial",
                )
            )

        session.add_all(records)
        session.flush()

        reviews = [
            ReviewItem(
                patient_id=patients[0].id,
                session_id=records[6].id,
                reason_code="PAIN_INCREASE",
                reason="Synthetic demo flag: reported pain increased versus earlier sessions.",
                status="pending",
            ),
            ReviewItem(
                patient_id=patients[1].id,
                session_id=records[7].id,
                reason_code="LOW_TRACKING_QUALITY",
                reason="Synthetic demo flag: tracking quality was poor in this session.",
                status="pending",
            ),
        ]
        session.add_all(reviews)

        # One transaction: all records commit together or roll back on failure.
        session.commit()

        print("Demo data seeded successfully.")
        print(
            {
                "patients": len(patients),
                "exercise_plans": len(plans),
                "sessions": len(records),
                "review_items": len(reviews),
            }
        )


if __name__ == "__main__":
    seed_demo_data()
