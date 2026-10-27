from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.db import get_session
from app.main import app
from app.models import (
    ClinicianPatientAssignment,
    Patient,
    ReviewItem,
    User,
)
from app.security import create_access_token, hash_password


@pytest.fixture
def client():
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(test_engine)

    def override_get_session():
        with Session(test_engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session

    with Session(test_engine) as session:
        assigned_patient = Patient(
            display_name="Assigned Patient",
            pathway="Test Recovery",
            recovery_start=date(2026, 1, 1),
        )
        unassigned_patient = Patient(
            display_name="Unassigned Patient",
            pathway="Test Recovery",
            recovery_start=date(2026, 1, 1),
        )
        session.add_all([assigned_patient, unassigned_patient])
        session.commit()
        session.refresh(assigned_patient)
        session.refresh(unassigned_patient)

        clinician = User(
            email="clinician@example.com",
            password_hash=hash_password("test-clinician-password"),
            role="clinician",
            is_active=True,
        )
        patient_user = User(
            email="patient@example.com",
            password_hash=hash_password("test-patient-password"),
            role="patient",
            patient_id=assigned_patient.id,
            is_active=True,
        )
        session.add_all([clinician, patient_user])
        session.commit()
        session.refresh(clinician)
        session.refresh(patient_user)

        assert clinician.id is not None
        assert patient_user.id is not None
        assert assigned_patient.id is not None
        assert unassigned_patient.id is not None

        session.add(
            ClinicianPatientAssignment(
                clinician_user_id=clinician.id,
                patient_id=assigned_patient.id,
            )
        )

        assigned_review = ReviewItem(
            patient_id=assigned_patient.id,
            reason_code="TEST_FLAG",
            reason="Assigned patient's review item",
            status="pending",
        )
        unassigned_review = ReviewItem(
            patient_id=unassigned_patient.id,
            reason_code="TEST_FLAG",
            reason="Unassigned patient's review item",
            status="pending",
        )
        session.add_all([assigned_review, unassigned_review])
        session.commit()
        session.refresh(assigned_review)
        session.refresh(unassigned_review)

        assert assigned_review.id is not None
        assert unassigned_review.id is not None

        assigned_review_id = assigned_review.id
        unassigned_review_id = unassigned_review.id

        clinician_headers = {
            "Authorization": f"Bearer {create_access_token(clinician.id, 'clinician')}"
        }
        patient_headers = {
            "Authorization": f"Bearer {create_access_token(patient_user.id, 'patient')}"
        }

    try:
        with TestClient(app) as test_client:
            yield (
                test_client,
                assigned_review_id,
                unassigned_review_id,
                clinician_headers,
                patient_headers,
            )
    finally:
        app.dependency_overrides.clear()
        test_engine.dispose()


def test_add_note_saves_note_and_preserves_status(client):
    test_client, review_id, _, clinician_headers, _ = client

    response = test_client.post(
        f"/review-queue/{review_id}/notes",
        json={"note": "  Follow-up assessment required.  "},
        headers=clinician_headers,
    )

    assert response.status_code == 200
    assert response.json()["clinician_note"] == "Follow-up assessment required."
    assert response.json()["status"] == "pending"
    assert response.json()["reviewed_at"] is None


def test_add_note_returns_404_for_missing_review(client):
    test_client, _, _, clinician_headers, _ = client

    response = test_client.post(
        "/review-queue/99999/notes",
        json={"note": "Check this item"},
        headers=clinician_headers,
    )

    assert response.status_code == 404


@pytest.mark.parametrize(
    "note",
    ["", "   ", "x" * 2001],
)
def test_add_note_rejects_invalid_note(client, note):
    test_client, review_id, _, clinician_headers, _ = client

    response = test_client.post(
        f"/review-queue/{review_id}/notes",
        json={"note": note},
        headers=clinician_headers,
    )

    assert response.status_code == 422


def test_review_queue_requires_authentication(client):
    test_client, _, _, _, _ = client

    response = test_client.get("/review-queue")

    assert response.status_code == 401


def test_patient_cannot_access_clinician_review_queue(client):
    test_client, _, _, _, patient_headers = client

    response = test_client.get(
        "/review-queue",
        headers=patient_headers,
    )

    assert response.status_code == 403


def test_clinician_sees_only_assigned_patients_reviews(client):
    test_client, assigned_review_id, unassigned_review_id, clinician_headers, _ = client

    response = test_client.get(
        "/review-queue",
        headers=clinician_headers,
    )

    assert response.status_code == 200
    review_ids = {item["id"] for item in response.json()}
    assert assigned_review_id in review_ids
    assert unassigned_review_id not in review_ids


def test_clinician_cannot_add_note_to_unassigned_patients_review(client):
    test_client, _, unassigned_review_id, clinician_headers, _ = client

    response = test_client.post(
        f"/review-queue/{unassigned_review_id}/notes",
        json={"note": "Unauthorized note"},
        headers=clinician_headers,
    )

    assert response.status_code == 404


def test_add_note_requires_authentication(client):
    test_client, review_id, _, _, _ = client

    response = test_client.post(
        f"/review-queue/{review_id}/notes",
        json={"note": "Follow-up assessment required."},
    )

    assert response.status_code == 401
