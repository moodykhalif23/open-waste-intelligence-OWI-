from owi_api.ratelimit import SlidingWindowLimiter


class FakeClock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


def test_blocks_after_limit() -> None:
    limiter = SlidingWindowLimiter(limit=3, window_seconds=60, clock=FakeClock())
    assert all(limiter.allow("k") for _ in range(3))
    assert not limiter.allow("k")


def test_window_slides() -> None:
    clock = FakeClock()
    limiter = SlidingWindowLimiter(limit=2, window_seconds=60, clock=clock)
    assert limiter.allow("k") and limiter.allow("k")
    assert not limiter.allow("k")
    clock.now = 61
    assert limiter.allow("k")


def test_keys_are_independent() -> None:
    limiter = SlidingWindowLimiter(limit=1, window_seconds=60, clock=FakeClock())
    assert limiter.allow("a")
    assert limiter.allow("b")
    assert not limiter.allow("a")
