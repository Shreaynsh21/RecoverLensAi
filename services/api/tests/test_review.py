from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.db import get_session
from app.main import app
from app.models import Patient, ReviewItem


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
        patient = Patient(
            display_name="Test Patient",
            pathway="Test Recovery",
            recovery_start=date(2026, 1, 1),
        )
        session.add(patient)
        session.commit()
        session.refresh(patient)

        review_item = ReviewItem(
            patient_id=patient.id,
            reason_code="TEST_FLAG",
            reason="Test review item",
            status="pending",
        )
        session.add(review_item)
        session.commit()
        session.refresh(review_item)
        review_id = review_item.id

    with TestClient(app) as test_client:
        yield test_client, review_id

    app.dependency_overrides.clear()
    test_engine.dispose()


def test_add_note_saves_note_and_preserves_status(client):
    test_client, review_id = client

    response = test_client.post(
        f"/review-queue/{review_id}/notes",
        json={"note": "  Follow-up assessment required.  "},
    )

    assert response.status_code == 200
    assert response.json()["clinician_note"] == "Follow-up assessment required."
    assert response.json()["status"] == "pending"
    assert response.json()["reviewed_at"] is None


def test_add_note_returns_404_for_missing_review(client):
    test_client, _ = client

    response = test_client.post(
        "/review-queue/99999/notes",
        json={"note": "Check this item"},
    )

    assert response.status_code == 404


@pytest.mark.parametrize(
    "note",
    ["", "   ", "x" * 2001],
)
def test_add_note_rejects_invalid_note(client, note):
    test_client, review_id = client

    response = test_client.post(
        f"/review-queue/{review_id}/notes",
        json={"note": note},
    )

    assert response.status_code == 422
