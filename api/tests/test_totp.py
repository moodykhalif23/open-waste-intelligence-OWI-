import base64

from owi_api.security import new_totp_secret, totp_now, verify_totp

# RFC 6238 appendix B test secret ("12345678901234567890").
RFC_SECRET = base64.b32encode(b"12345678901234567890").decode()


def test_rfc6238_vectors_last_six_digits() -> None:
    assert totp_now(RFC_SECRET, at=59) == "287082"
    assert totp_now(RFC_SECRET, at=1111111109) == "081804"
    assert totp_now(RFC_SECRET, at=1234567890) == "005924"


def test_verify_accepts_adjacent_steps_only() -> None:
    code = totp_now(RFC_SECRET, at=59)
    assert verify_totp(RFC_SECRET, code, at=59)
    assert verify_totp(RFC_SECRET, code, at=59 + 30)  # one step of drift
    assert not verify_totp(RFC_SECRET, code, at=59 + 120)


def test_verify_rejects_garbage() -> None:
    assert not verify_totp(RFC_SECRET, "000000", at=59)
    assert not verify_totp("not-base32!!", "287082", at=59)


def test_new_secret_is_base32_and_verifiable() -> None:
    secret = new_totp_secret()
    assert verify_totp(secret, totp_now(secret, at=1000), at=1000)
