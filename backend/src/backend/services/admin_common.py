"""Shared helpers and canonical constants for Pipeline Admin services."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import get_args, overload

import psycopg.errors
from sqlalchemy.exc import ProgrammingError

from backend.schemas.admin import LoopName

VALID_LOOP_NAMES: frozenset[str] = frozenset(get_args(LoopName))


@overload
def ensure_utc(dt: datetime) -> datetime: ...


@overload
def ensure_utc(dt: None) -> None: ...


@overload
def ensure_utc(dt: datetime | None) -> datetime | None: ...


def ensure_utc(dt: datetime | None) -> datetime | None:
    """Normalize a datetime (naive or offset-aware) to UTC, preserving None."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def is_undefined_table_error(exc: ProgrammingError) -> bool:
    """Return True when a SQLAlchemy ProgrammingError represents PostgreSQL 42P01 UndefinedTable."""
    orig = getattr(exc, "orig", None)
    if isinstance(orig, psycopg.errors.UndefinedTable):
        return True
    return getattr(orig, "sqlstate", None) == "42P01"


def normalize_stats(raw_stats: object) -> dict[str, int] | None:
    """Coerce a JSONB stats mapping into dict[str, int], or return None if absent/invalid."""
    if not isinstance(raw_stats, dict):
        return None
    return {str(k): int(v) for k, v in raw_stats.items()}
