from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from owi_api.models.enums import FillBand

LOCAL_TZ_NAME = "Africa/Nairobi"
LOCAL_TZ = ZoneInfo(LOCAL_TZ_NAME)


@dataclass(frozen=True)
class Window:
    first_day: date
    start: datetime
    prev_start: datetime
    end: datetime


@dataclass(frozen=True)
class DayCount:
    date: date
    reports: int
    overflowing: int


def window(now: datetime, days: int) -> Window:
    first_day = now.astimezone(LOCAL_TZ).date() - timedelta(days=days - 1)
    start = datetime.combine(first_day, time.min, LOCAL_TZ)
    return Window(first_day, start, start - timedelta(days=days), now)


def per_day(first_day: date, days: int, counts: dict[date, tuple[int, int]]) -> list[DayCount]:
    out = []
    for offset in range(days):
        day = first_day + timedelta(days=offset)
        reports, overflowing = counts.get(day, (0, 0))
        out.append(DayCount(day, reports, overflowing))
    return out


def heatmap(cells: Iterable[tuple[int, int, int]]) -> list[list[int]]:
    grid = [[0] * 24 for _ in range(7)]
    for iso_weekday, hour, count in cells:
        grid[iso_weekday - 1][hour] += count
    return grid


def fill_mix(counts: dict[FillBand | None, int]) -> dict[str, int]:
    return {band.value: counts.get(band, 0) for band in FillBand}
