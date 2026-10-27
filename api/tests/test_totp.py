import base64

from owi_api.security import new_totp_secret, verify_totp

# RFC 6238 appendix B test secret ("12345678901234567890").
RFC_SECRET = base64.b32encode(b"12345678901234567890").decode()


def test_rfc6238_vectors_last_six_digits() -> None:
    assert verify_totp(RFC_SECRET, "287082", at=59, window=0)
    assert verify_totp(RFC_SECRET, "081804", at=1111111109, window=0)
    assert verify_totp(RFC_SECRET, "005924", at=1234567890, window=0)


def test_verify_accepts_adjacent_steps_only() -> None:
    assert verify_totp(RFC_SECRET, "287082", at=59 + 30)  # one step of drift
    assert not verify_totp(RFC_SECRET, "287082", at=59 + 120)


def test_verify_rejects_garbage() -> None:
    assert not verify_totp(RFC_SECRET, "000000", at=59)
    assert not verify_totp("not-base32!!", "287082", at=59)


def test_new_secret_is_160_bit_base32() -> None:
    assert len(base64.b32decode(new_totp_secret())) == 20
