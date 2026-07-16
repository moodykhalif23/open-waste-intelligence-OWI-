from fastapi import Request

from owi_api.audit import client_ip


def make_request(headers: list[tuple[bytes, bytes]], client: tuple[str, int] | None) -> Request:
    return Request(
        {"type": "http", "method": "GET", "path": "/", "headers": headers, "client": client}
    )


def test_forwarded_for_first_hop_wins() -> None:
    request = make_request([(b"x-forwarded-for", b"41.90.1.2, 10.0.0.1")], ("172.18.0.9", 1234))
    assert client_ip(request) == "41.90.1.2"


def test_falls_back_to_socket_peer() -> None:
    assert client_ip(make_request([], ("192.168.1.7", 1234))) == "192.168.1.7"


def test_handles_missing_request_and_client() -> None:
    assert client_ip(None) is None
    assert client_ip(make_request([], None)) is None
