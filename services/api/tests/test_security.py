from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.config import settings
from app.security import (
    ALGORITHM,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_password_hash_verifies_correct_password():
    hashed = hash_password("TestPassword123!")

    assert hashed != "TestPassword123!"
    assert verify_password("TestPassword123!", hashed)
    assert not verify_password("WrongPassword123!", hashed)


def test_access_token_contains_expected_claims():
    token = create_access_token(user_id=42, role="clinician")

    claims = decode_access_token(token)

    assert claims["sub"] == "42"
    assert claims["role"] == "clinician"
    assert claims["iat"] is not None
    assert claims["exp"] > claims["iat"]


def test_tampered_token_is_rejected():
    token = create_access_token(user_id=42, role="clinician")
    tampered_token = token[:-1] + ("A" if token[-1] != "A" else "B")

    with pytest.raises(jwt.InvalidTokenError):
        decode_access_token(tampered_token)


def test_expired_token_is_rejected():
    now = datetime.now(UTC)
    expired_token = jwt.encode(
        {
            "sub": "42",
            "role": "clinician",
            "iat": now - timedelta(minutes=10),
            "exp": now - timedelta(minutes=5),
        },
        settings.jwt_secret_key,
        algorithm=ALGORITHM,
    )

    with pytest.raises(jwt.ExpiredSignatureError):
        decode_access_token(expired_token)


@pytest.mark.parametrize(
    "claims",
    [
        {"role": "clinician", "iat": 1, "exp": 9999999999},
        {"sub": "42", "role": "clinician", "exp": 9999999999},
        {"sub": "42", "role": "clinician", "iat": 1},
    ],
)
def test_token_missing_required_claim_is_rejected(claims):
    token = jwt.encode(
        claims,
        settings.jwt_secret_key,
        algorithm=ALGORITHM,
    )

    with pytest.raises(jwt.MissingRequiredClaimError):
        decode_access_token(token)
